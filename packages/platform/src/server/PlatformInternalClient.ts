import { InternalAuthClient } from "@mosaik/auth/server"
import { Config, Context, Effect, Layer } from "effect"
import { FetchHttpClient } from "effect/http"
import { HttpApiClient } from "effect/http-api"
import { PlatformInternalApi } from "../contract/internal"

/** Typed client for the platform service's internal API (`PLATFORM_URL`), for Core's services. */
export class PlatformInternalClient extends Context.Service<
  PlatformInternalClient,
  HttpApiClient.ForApi<typeof PlatformInternalApi>
>()("@mosaik/platform/PlatformInternalClient") {
  static readonly layer = Layer.effect(
    PlatformInternalClient,
    Effect.gen(function* () {
      const baseUrl = yield* Config.URL("PLATFORM_URL")
      return yield* HttpApiClient.make(PlatformInternalApi, { baseUrl })
    }),
  ).pipe(Layer.provide([InternalAuthClient, FetchHttpClient.layer]))
}
