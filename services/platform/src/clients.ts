import { InternalAuthClient } from "@mosaik/auth/server"
import { NotificationsInternalApi } from "@mosaik/notifications/contract"
import { Config, Context, Effect, Layer } from "effect"
import { FetchHttpClient } from "effect/http"
import { HttpApiClient } from "effect/http-api"

/** The notifications service's internal API (`NOTIFICATIONS_URL`). */
export class NotificationsClient extends Context.Service<
  NotificationsClient,
  HttpApiClient.ForApi<typeof NotificationsInternalApi>
>()("@mosaik/platform-service/NotificationsClient") {
  static readonly layer = Layer.effect(
    NotificationsClient,
    Effect.gen(function* () {
      const baseUrl = yield* Config.URL("NOTIFICATIONS_URL")
      return yield* HttpApiClient.make(NotificationsInternalApi, { baseUrl })
    }),
  ).pipe(Layer.provide([InternalAuthClient, FetchHttpClient.layer]))
}
