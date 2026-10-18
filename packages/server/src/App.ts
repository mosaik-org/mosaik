import { AccessControlLive, TokenVerifier } from "@mosaik/auth/server"
import type { AccessControl, AnyApp } from "@mosaik/core"
import { type AppManifest, JWKS_URL_PATH, MANIFEST_PATH, toAppManifest } from "@mosaik/platform/contract"
import { PlatformClient } from "@mosaik/platform/server"
import { Config, Effect, Layer, Option } from "effect"
import { FetchHttpClient, type HttpClient, HttpRouter, HttpServerResponse } from "effect/http"
import { type HttpApi, HttpApiBuilder, type HttpApiGroup } from "effect/http-api"
import { Audit } from "./Audit"
import { EventConsumer, type EventHandlers } from "./Events"
import { Messages } from "./Messages"
import { Notify } from "./Notify"
import { Registration } from "./Registration"
import { runMain, serve } from "./Server"
import { standaloneRoutes } from "./Standalone"
import { loadWebBundle, webAssetsRoute } from "./WebAssets"

/** Services every app backend gets for free (plus the `AccessControl` middleware). */
export type AppServices = Audit | Messages | Notify | HttpClient.HttpClient | AccessControl

export interface AppServerOptions<Id extends string, Groups extends HttpApiGroup.Constraint, E, R> {
  readonly app: AnyApp
  /** The app's API contract (from `api/`), with `AccessControl` middleware. */
  readonly api: HttpApi.HttpApi<Id, Groups>
  /** Implementations of every group in `api`. Provide your own dependencies (e.g. `Database.layer`). */
  readonly handlers: Layer.Layer<HttpApiGroup.ToService<Id, Groups>, E, R>
  /** Handlers of the platform events the app subscribes to (`Events.handlers`). */
  readonly events?: Layer.Layer<EventHandlers, unknown, AppServices>
}

/** The app's manifest as static JSON, read by the platform when it is installed. */
const ManifestRoute = (manifest: AppManifest) =>
  HttpRouter.add("GET", MANIFEST_PATH, Effect.succeed(HttpServerResponse.jsonUnsafe(manifest)))

/**
 * Builds an app backend: the API under `/api/<id>`, access control, manifest
 * registration, audit log, messages and notifications, platform events, its browser
 * bundle (if built), health check and observability.
 *
 * Everything platform-related goes through the platform API (`PLATFORM_URL`), authenticated
 * with the app's key, so the same backend works built in, hosted elsewhere or as an image.
 * With `MOSAIK_PUBLIC_URL` the app is standalone: it serves its own page there and signs
 * people in through Core (see `standaloneRoutes`), with the same code.
 */
export const makeAppServer = <Id extends string, Groups extends HttpApiGroup.Constraint, E, R extends AppServices>(
  options: AppServerOptions<Id, Groups, E, R>,
): Layer.Layer<never, unknown> =>
  Layer.unwrap(
    Effect.gen(function* () {
      const standalone = Option.isSome(yield* Config.option(Config.String("MOSAIK_PUBLIC_URL")))
      if (standalone) return makeServer(options, toAppManifest(options.app), standaloneRoutes(options.app))
      const web = yield* loadWebBundle
      const manifest = toAppManifest(options.app, Option.getOrNull(Option.map(web, ({ bundle }) => bundle)))
      const assets: Layer.Layer<never, never, HttpRouter.HttpRouter> = Option.match(web, {
        onNone: () => Layer.empty,
        onSome: ({ dir }) => webAssetsRoute(options.app, dir),
      })
      return makeServer(options, manifest, assets)
    }),
  )

const makeServer = <Id extends string, Groups extends HttpApiGroup.Constraint, E, R extends AppServices>(
  options: AppServerOptions<Id, Groups, E, R>,
  manifest: AppManifest,
  /** The browser side: the bundle the shell loads, or a standalone app's page and sign-in. */
  assets: Layer.Layer<never, unknown, HttpRouter.HttpRouter | TokenVerifier>,
): Layer.Layer<never, unknown> => {
  const { app } = options
  if (app.events.length > 0 && options.events === undefined) {
    throw new Error(`"${app.id}" subscribes to events (${app.events.join(", ")}): pass their handlers`)
  }
  if (app.events.length === 0 && options.events !== undefined) {
    throw new Error(`"${app.id}" has event handlers but subscribes to no events: add them to the manifest`)
  }

  const Platform = Layer.mergeAll(Audit.layer, Messages.layer, Notify.layer, FetchHttpClient.layer).pipe(
    Layer.provideMerge(Registration.layer(manifest)),
    Layer.provideMerge(PlatformClient.layer(app.id)),
  )

  const ApiRoutes = HttpApiBuilder.layer(options.api, { openapiPath: `${app.apiPrefix}/openapi.json` }).pipe(
    Layer.provide(options.handlers),
  )

  // Tokens are issued for this app only; the keys come from the platform.
  const Verifier = TokenVerifier.layerJwks(
    app.id,
    Config.URL("PLATFORM_URL").pipe(Config.map((url) => new URL(JWKS_URL_PATH, url))),
  )

  const Consumer = options.events === undefined ? Layer.empty : EventConsumer.pipe(Layer.provide(options.events))

  const server = serve(Layer.mergeAll(ApiRoutes, ManifestRoute(manifest), assets, Consumer), {
    name: `mosaik-${app.id}`,
  }).pipe(Layer.provide(AccessControlLive(app).pipe(Layer.provideMerge(Verifier))), Layer.provide(Platform))
  // TypeScript cannot reduce the router's request types for a generic `R`; the
  // `R extends AppServices` constraint guarantees everything is provided.
  return server as Layer.Layer<never, unknown>
}

/** Process entrypoint for an app backend (`server/main.ts`). */
export const runApp = <Id extends string, Groups extends HttpApiGroup.Constraint, E, R extends AppServices>(
  options: AppServerOptions<Id, Groups, E, R>,
): void => runMain(makeAppServer(options))
