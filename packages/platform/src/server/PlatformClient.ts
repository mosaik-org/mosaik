import { Config, Context, Effect, Layer, Option, Redacted } from "effect"
import { FetchHttpClient, HttpClientRequest } from "effect/http"
import { HttpApiClient, HttpApiMiddleware } from "effect/http-api"
import { APP_KEY_HEADER, AppAuth, PlatformApi } from "../contract/api"
import { derivedAppKey } from "./keys"

/**
 * The app's key: `MOSAIK_APP_KEY` (issued when the Portal installs it, or derived for a
 * configured app), or derived from `INTERNAL_KEY` for built-in apps, which ship with the platform.
 */
export const appKey = Effect.fn("appKey")(function* (appId: string) {
  const explicit = yield* Config.Redacted("MOSAIK_APP_KEY").pipe(Config.withDefault(Redacted.make("")))
  if (Redacted.value(explicit).length > 0) return explicit
  const internal = yield* Config.option(Config.Redacted("INTERNAL_KEY"))
  if (Option.isSome(internal)) return derivedAppKey(internal.value, appId)
  // Not installed yet: the app still starts (the platform reads its manifest to install it),
  // but every platform call is refused until it has a key.
  yield* Effect.logWarning("MOSAIK_APP_KEY is not set: install the app in the platform and set the key it shows")
  return Redacted.make("")
})

/** Typed client for the platform API (`PLATFORM_URL`), authenticated as the app. */
export class PlatformClient extends Context.Service<PlatformClient, HttpApiClient.ForApi<typeof PlatformApi>>()(
  "@mosaik/platform/PlatformClient",
) {
  static readonly layer = (appId: string) =>
    Layer.effect(
      PlatformClient,
      Effect.gen(function* () {
        const baseUrl = yield* Config.URL("PLATFORM_URL")
        return yield* HttpApiClient.make(PlatformApi, { baseUrl })
      }),
    ).pipe(
      Layer.provide(
        Layer.unwrap(
          Effect.gen(function* () {
            const key = yield* appKey(appId)
            return HttpApiMiddleware.layerClient(AppAuth, ({ next, request }) =>
              next(HttpClientRequest.setHeader(request, APP_KEY_HEADER, Redacted.value(key))),
            )
          }),
        ),
      ),
      Layer.provide(FetchHttpClient.layer),
    )
}
