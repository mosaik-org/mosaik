import { assert, layer } from "@effect/vitest"
import { AccessControl, CurrentPrincipal, defineApp, RequiredPermission } from "@mosaik/core"
import { Effect, Layer, Schema } from "effect"
import { HttpClientRequest, HttpServer } from "effect/http"
import { HttpApi, HttpApiBuilder, HttpApiEndpoint, HttpApiGroup, HttpApiMiddleware, HttpApiTest } from "effect/http-api"
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose"
import { TOKEN_ALGORITHM, TOKEN_ISSUER } from "../contract/token"
import { AccessControlLive, AccessControlUsers } from "./AccessControl"
import { TokenVerifier } from "./TokenVerifier"

const demo = defineApp({
  id: "demo",
  name: "Demo",
  access: "view",
  permissions: { view: { description: "View" }, "things.delete": { description: "Delete things" } },
})

class ThingsGroup extends HttpApiGroup.make("things").add(
  HttpApiEndpoint.get("list", "/things", { success: Schema.String }),
  HttpApiEndpoint.delete("remove", "/things", { success: Schema.String }).annotate(
    RequiredPermission,
    demo.perm("things.delete"),
  ),
) {}

class DemoApi extends HttpApi.make("demo").add(ThingsGroup).prefix(demo.apiPrefix).middleware(AccessControl) {}

const Handlers = HttpApiBuilder.group(DemoApi, "things", (handlers) =>
  handlers.handleAll({
    list: () =>
      Effect.gen(function* () {
        const principal = yield* CurrentPrincipal
        return principal.user?.name ?? "anonymous"
      }),
    remove: () => Effect.succeed("deleted"),
  }),
)

const keys = await generateKeyPair(TOKEN_ALGORITHM, { crv: "Ed25519", extractable: true })
const publicJwk = { ...(await exportJWK(keys.publicKey)), kid: "test", alg: TOKEN_ALGORITHM }

const token = (
  grants: ReadonlyArray<string>,
  user: { id: string; name: string } | null = null,
  issuer = TOKEN_ISSUER,
  audience: string = demo.id,
) =>
  new SignJWT({ user: user && { ...user, email: `${user.id}@test`, image: null }, grants: [...grants] })
    .setProtectedHeader({ alg: TOKEN_ALGORITHM, kid: "test" })
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime("1m")
    .sign(keys.privateKey)

const withToken = (value: string) =>
  HttpApiMiddleware.layerClient(AccessControl, ({ next, request }) =>
    next(HttpClientRequest.bearerToken(request, value)),
  )

const ServerLayer = Handlers.pipe(
  Layer.provideMerge(AccessControlLive(demo)),
  Layer.provide(Layer.succeed(TokenVerifier, TokenVerifier.make(createLocalJWKSet({ keys: [publicJwk] }), demo.id))),
)

const makeClient = HttpApiTest.groups(DemoApi, ["things"])
type Client = Effect.Success<typeof makeClient>

/** Calls the API as the bearer of a freshly signed token (client middleware binds when the client is built). */
const as = <A, E>(signed: Promise<string>, request: (client: Client) => Effect.Effect<A, E>) =>
  Effect.gen(function* () {
    const value = yield* Effect.promise(() => signed)
    return yield* Effect.flatMap(makeClient, request).pipe(Effect.provide(withToken(value)))
  })

const ada = { id: "u1", name: "Ada" }

layer(Layer.mergeAll(ServerLayer, HttpServer.layerServices))("AccessControl", (it) => {
  it.effect("requires the app access permission by default", () =>
    Effect.gen(function* () {
      const name = yield* as(token(["demo:view"], ada), (api) => api.things.list())
      assert.strictEqual(name, "Ada")
    }),
  )

  it.effect("accepts wildcard grants", () =>
    Effect.gen(function* () {
      const result = yield* as(token(["*"], ada), (api) => api.things.remove())
      assert.strictEqual(result, "deleted")
    }),
  )

  it.effect("returns Forbidden for users without the endpoint's permission", () =>
    Effect.gen(function* () {
      const error = yield* as(token(["demo:view"], ada), (api) => api.things.remove()).pipe(Effect.flip)
      assert.strictEqual(error._tag, "Forbidden")
    }),
  )

  it.effect("returns Unauthorized for anonymous principals without access", () =>
    Effect.gen(function* () {
      const error = yield* as(token([]), (api) => api.things.list()).pipe(Effect.flip)
      assert.strictEqual(error._tag, "Unauthorized")
    }),
  )

  it.effect("lets anonymous principals in when their role grants access", () =>
    Effect.gen(function* () {
      const name = yield* as(token(["demo:view"]), (api) => api.things.list())
      assert.strictEqual(name, "anonymous")
    }),
  )

  it.effect("rejects tokens meant for another service", () =>
    Effect.gen(function* () {
      const error = yield* as(token(["*"], ada, TOKEN_ISSUER, "other-app"), (api) => api.things.list()).pipe(
        Effect.flip,
      )
      assert.strictEqual(error._tag, "Unauthorized")
    }),
  )

  it.effect("rejects tokens from another issuer", () =>
    Effect.gen(function* () {
      const error = yield* as(token(["*"], ada, "someone-else"), (api) => api.things.list()).pipe(Effect.flip)
      assert.strictEqual(error._tag, "Unauthorized")
    }),
  )
})

const UsersServerLayer = Handlers.pipe(
  Layer.provideMerge(AccessControlUsers),
  Layer.provide(Layer.succeed(TokenVerifier, TokenVerifier.make(createLocalJWKSet({ keys: [publicJwk] }), demo.id))),
)

layer(Layer.mergeAll(UsersServerLayer, HttpServer.layerServices))("AccessControlUsers", (it) => {
  it.effect("lets in any logged-in user without a specific permission", () =>
    Effect.gen(function* () {
      const name = yield* as(token([], ada), (api) => api.things.list())
      assert.strictEqual(name, "Ada")
    }),
  )

  it.effect("rejects anonymous principals, whatever they are granted", () =>
    Effect.gen(function* () {
      const error = yield* as(token(["*"]), (api) => api.things.list()).pipe(Effect.flip)
      assert.strictEqual(error._tag, "Unauthorized")
    }),
  )

  it.effect("still enforces annotated permissions", () =>
    Effect.gen(function* () {
      const error = yield* as(token(["demo:view"], ada), (api) => api.things.remove()).pipe(Effect.flip)
      assert.strictEqual(error._tag, "Forbidden")
      const result = yield* as(token(["demo:things.delete"], ada), (api) => api.things.remove())
      assert.strictEqual(result, "deleted")
    }),
  )
})
