import { InternalAuthClient } from "@mosaik/auth/server"
import { PlatformInternalApi } from "@mosaik/platform/contract"
import { Config, Context, Effect, Layer } from "effect"
import { FetchHttpClient } from "effect/http"
import { HttpApiClient } from "effect/http-api"

/** The platform service's internal API (`PLATFORM_URL`): where events go, and who apps are. */
export class PlatformClient extends Context.Service<PlatformClient, HttpApiClient.ForApi<typeof PlatformInternalApi>>()(
  "@mosaik/auth-service/PlatformClient",
) {
  static readonly layer = Layer.effect(
    PlatformClient,
    Effect.gen(function* () {
      return yield* HttpApiClient.make(PlatformInternalApi, { baseUrl: yield* Config.URL("PLATFORM_URL") })
    }),
  ).pipe(Layer.provide([InternalAuthClient, FetchHttpClient.layer]))
}
