import { AppRoute, ROUTES_STREAM_PATH } from "@mosaik/platform/contract"
import { Config, Context, Deferred, Duration, Effect, Layer, Ref, Schema } from "effect"
import { FetchHttpClient } from "effect/http"
import { followEventStream } from "./follow"

const PREFIX = "UPSTREAM_"

/** Where a request goes, and which token it gets. */
export interface Route {
  readonly url: URL
  /** The token's audience: the service it is for. */
  readonly audience: string
  /** Apps get only their own grants; platform services get all (`null`). */
  readonly scope: string | null
}

/**
 * Platform services, configured with `UPSTREAM_<SERVICE>=<url>` environment variables,
 * e.g. `UPSTREAM_AUTH=http://auth:3000`, `UPSTREAM_NOTIFICATIONS=http://notifications:3000`.
 */
export const staticRoutes = (env: Record<string, string | undefined>) =>
  Effect.gen(function* () {
    const routes = new Map<string, Route>()
    for (const [name, value] of Object.entries(env)) {
      if (!name.startsWith(PREFIX) || !value) continue
      const service = name.slice(PREFIX.length).toLowerCase().replaceAll("_", "-")
      const url = yield* Effect.try({
        try: () => new URL(value),
        catch: () => new Error(`${name} is not a valid URL: ${value}`),
      })
      routes.set(service, { url, audience: service, scope: null })
    }
    if (!routes.has("auth")) return yield* Effect.fail(new Error(`${PREFIX}AUTH is required`))
    return routes as ReadonlyMap<string, Route>
  })

/** How long a request for an unknown app waits for the routes at startup. */
const STARTUP_WAIT = Duration.seconds(5)

/**
 * Where each `/api/<service>/*` prefix is proxied to: platform services from the
 * environment, apps from the platform's registry (`PLATFORM_URL`). The platform streams
 * the app routes, when connecting and after every change, so installs and uninstalls
 * take effect at once. Platform services win if an app claims the same id.
 */
export class Upstreams extends Context.Service<
  Upstreams,
  { resolve(service: string): Effect.Effect<Route | undefined> }
>()("@mosaik/gateway/Upstreams") {
  static readonly layer = Layer.effect(
    Upstreams,
    Effect.gen(function* () {
      const platform = yield* staticRoutes(process.env).pipe(Effect.orDie)
      const url = new URL(ROUTES_STREAM_PATH, yield* Config.URL("PLATFORM_URL"))
      const key = yield* Config.Redacted("INTERNAL_KEY")
      const apps = yield* Ref.make<ReadonlyMap<string, Route>>(new Map())
      const loaded = yield* Deferred.make<void>()

      const update = (routes: ReadonlyArray<AppRoute>) =>
        Ref.set(
          apps,
          new Map(
            routes.map((route) => [route.id, { url: new URL(route.upstream), audience: route.id, scope: route.id }]),
          ),
        ).pipe(
          Effect.andThen(Deferred.succeed(loaded, undefined)),
          Effect.andThen(Effect.logInfo("App routes", { apps: routes.map((route) => route.id) })),
        )

      // Until the platform answers again, the last known routes stay in use.
      yield* followEventStream({ name: "App route", url, key, schema: Schema.Array(AppRoute), onEvent: update })
      yield* Effect.logInfo("Platform services", { services: [...platform.keys()] })

      return Upstreams.of({
        resolve: Effect.fn("Upstreams.resolve")(function* (service: string) {
          const known = platform.get(service)
          if (known !== undefined) return known
          // Right after startup, before the first routes arrived.
          yield* Deferred.await(loaded).pipe(Effect.timeoutOption(STARTUP_WAIT))
          return (yield* Ref.get(apps)).get(service)
        }),
      })
    }),
  ).pipe(Layer.provide(FetchHttpClient.layer))
}
