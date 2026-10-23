import { TOKEN_ALGORITHM, TOKEN_ISSUER } from "@mosaik/auth/contract"
import { AccessControlLive, TokenVerifier } from "@mosaik/auth/server"
import { AccessControl, type AnyApp } from "@mosaik/core"
import type { AppServices, EventHandlers } from "@mosaik/server"
import { Context, Effect, Layer } from "effect"
import { FetchHttpClient, HttpClientRequest, HttpServer } from "effect/http"
import { type HttpApi, type HttpApiClient, type HttpApiGroup, HttpApiMiddleware, HttpApiTest } from "effect/http-api"
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose"
import { TestAudit, TestEvents, TestMessages, TestNotify, TestSettings, TestStorage } from "./platform"

/** Who calls the app's API in a test: a person with grants, or a visitor (`user: null`). */
export interface TestPrincipal {
  readonly user: { readonly id: string; readonly name: string; readonly email: string } | null
  /** Permission keys (`sales:orders.refund`) or wildcards (`sales:*`). */
  readonly grants: ReadonlyArray<string>
}

/**
 * A signed-in person for a test: `AppTest.user({ grants: [sales.perm("orders.refund")] })`. Give
 * the app's access permission too when the endpoint needs nothing more: it is what opening the app takes.
 */
const user = (
  spec: {
    readonly id?: string
    readonly name?: string
    readonly email?: string
    readonly grants?: ReadonlyArray<string>
  } = {},
): TestPrincipal => {
  const id = spec.id ?? "test-user"
  return {
    user: { id, name: spec.name ?? "Test User", email: spec.email ?? `${id}@example.com` },
    grants: spec.grants ?? [],
  }
}

/** Someone not signed in. */
const visitor: TestPrincipal = { user: null, grants: [] }

/** Tokens for the test's people, signed with a key made for the test and trusted by the app's access control. */
class TestTokens extends Context.Service<TestTokens, { sign(principal: TestPrincipal): Effect.Effect<string> }>()(
  "@mosaik/testing/TestTokens",
) {}

const tokensFor = (app: AnyApp) =>
  Layer.unwrap(
    Effect.promise(async () => {
      const keys = await generateKeyPair(TOKEN_ALGORITHM, { crv: "Ed25519", extractable: true })
      const publicJwk = { ...(await exportJWK(keys.publicKey)), kid: "test", alg: TOKEN_ALGORITHM }
      return Layer.mergeAll(
        Layer.succeed(TokenVerifier, TokenVerifier.make(createLocalJWKSet({ keys: [publicJwk] }), app.id)),
        Layer.succeed(
          TestTokens,
          TestTokens.of({
            sign: (principal) =>
              Effect.promise(() =>
                new SignJWT({
                  user: principal.user && { ...principal.user, image: null },
                  grants: [...principal.grants],
                })
                  .setProtectedHeader({ alg: TOKEN_ALGORITHM, kid: "test" })
                  .setIssuer(TOKEN_ISSUER)
                  .setAudience(app.id)
                  .setIssuedAt()
                  .setExpirationTime("5m")
                  .sign(keys.privateKey),
              ),
          }),
        ),
      )
    }),
  )

export interface AppTestOptions<Id extends string, Groups extends HttpApiGroup.Constraint, E, R> {
  readonly app: AnyApp
  /** The app's API contract: only for its types here (pass it to `AppTest.client` to call it). */
  readonly api: HttpApi.HttpApi<Id, Groups>
  /** Its handlers, with the app's own dependencies provided (a database, or stand-ins of your own). */
  readonly handlers: Layer.Layer<HttpApiGroup.ToService<Id, Groups>, E, R>
  /** Its platform events' handlers (`Events.handlers`), to deliver events with `TestEvents`. */
  readonly events?: Layer.Layer<EventHandlers, unknown, AppServices>
}

/**
 * An app's backend in a test, without a server or the platform: its API runs in memory with its real
 * access control (people sign in with tokens made for the test), and the platform's services are
 * stand-ins that record what the app did (`TestAudit`, `TestNotify`, `TestMessages`, `TestSettings`,
 * `TestStorage`, `TestEvents`).
 *
 * @example
 * layer(AppTest.layer({ app: sales, api: SalesApi, handlers }))("Sales", (it) => {
 *   it.effect("refunds need orders.refund", () => Effect.gen(function* () {
 *     const api = yield* AppTest.client(SalesApi)
 *     const error = yield* Effect.flip(api.as(AppTest.user({ grants: [sales.accessPermission] }), (client) =>
 *       client.orders.refund({ params: { id }, payload: { reason: "Damaged" } })))
 *     expect(error._tag).toBe("Forbidden")
 *   }))
 * })
 */
export const AppTest = {
  user,
  visitor,

  /** The app, its access control and the platform's stand-ins, for `layer(...)` from `@effect/vitest` or `Effect.provide`. */
  layer: <Id extends string, Groups extends HttpApiGroup.Constraint, E, R extends AppServices>(
    options: AppTestOptions<Id, Groups, E, R>,
  ) => {
    const Platform = Layer.mergeAll(
      TestAudit.layer,
      TestNotify.layer,
      TestMessages.layer,
      TestSettings.layer,
      TestStorage.layer,
      FetchHttpClient.layer,
    )
    const Access = AccessControlLive(options.app).pipe(Layer.provideMerge(tokensFor(options.app)))
    const Events = options.events === undefined ? Layer.empty : TestEvents.layer.pipe(Layer.provide(options.events))
    return Layer.mergeAll(options.handlers, Events).pipe(
      Layer.provideMerge(Layer.mergeAll(Platform, Access)),
      Layer.provideMerge(HttpServer.layerServices),
    ) as unknown as Layer.Layer<
      | HttpApiGroup.ToService<Id, Groups>
      | TestAudit
      | TestNotify
      | TestMessages
      | TestSettings
      | TestStorage
      | TestEvents
      | TestTokens
      | AccessControl
      | Layer.Success<typeof HttpServer.layerServices>,
      E | Layer.Error<typeof options.handlers>
    >
  },

  /** The app's API, called as someone: `api.as(AppTest.user({ grants }), (client) => client.orders.list(...))`. */
  client: <Id extends string, Groups extends HttpApiGroup.Constraint>(api: HttpApi.HttpApi<Id, Groups>) =>
    Effect.gen(function* () {
      const tokens = yield* TestTokens
      const context = yield* Effect.context<
        HttpApiGroup.ToService<Id, Groups> | AccessControl | Layer.Success<typeof HttpServer.layerServices>
      >()
      // Every group of the API: the test calls whichever it wants.
      const groups = Object.keys(api.groups) as unknown as ReadonlyArray<HttpApiGroup.Identifier<Groups>>
      return {
        as: <A, E>(
          principal: TestPrincipal,
          call: (client: HttpApiClient.Client<Groups>) => Effect.Effect<A, E>,
        ): Effect.Effect<A, E> =>
          Effect.gen(function* () {
            const token = yield* tokens.sign(principal)
            const client = yield* HttpApiTest.groups(api, groups).pipe(
              Effect.provide(
                HttpApiMiddleware.layerClient(AccessControl, ({ next, request }) =>
                  next(HttpClientRequest.bearerToken(request, token)),
                ),
              ),
            )
            return yield* call(client as HttpApiClient.Client<Groups>)
          }).pipe(Effect.scoped, Effect.provide(context)) as Effect.Effect<A, E>,
      }
    }),
}
