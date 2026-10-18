import { InternalAuthClient } from "@mosaik/auth/server"
import type { BadRequest, Conflict, NotFound } from "@mosaik/core"
import { PlatformInternalApi } from "@mosaik/platform/contract"
import { Config, Context, Effect, Layer } from "effect"
import { FetchHttpClient } from "effect/http"
import { HttpApiClient } from "effect/http-api"

/** Core's platform service, internal API (`PLATFORM_URL`): the app registry and platform events. */
export class CoreClient extends Context.Service<CoreClient, HttpApiClient.ForApi<typeof PlatformInternalApi>>()(
  "@mosaik/portal-service/CoreClient",
) {
  static readonly layer = Layer.effect(
    CoreClient,
    Effect.gen(function* () {
      const baseUrl = yield* Config.URL("PLATFORM_URL")
      return yield* HttpApiClient.make(PlatformInternalApi, { baseUrl })
    }),
  ).pipe(Layer.provide([InternalAuthClient, FetchHttpClient.layer]))
}

/** What Core answers that the Portal handles; anything else (Core unreachable, a bad response) is a defect. */
type Answer = BadRequest | Conflict | NotFound
const ANSWERS: ReadonlySet<string> = new Set(["BadRequest", "Conflict", "NotFound"])

export const fromCore = <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, Extract<E, Answer>, R> =>
  effect.pipe(
    Effect.catch((error) =>
      typeof error === "object" && error !== null && "_tag" in error && ANSWERS.has(String(error._tag))
        ? Effect.fail(error as Extract<E, Answer>)
        : Effect.die(error),
    ),
  )
