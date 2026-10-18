import { timingSafeEqual } from "node:crypto"
import { Unauthorized } from "@mosaik/core"
import { Config, Context, Effect, Layer, Redacted } from "effect"
import { FetchHttpClient, HttpClientRequest } from "effect/http"
import { HttpApiClient, HttpApiMiddleware } from "effect/http-api"
import { INTERNAL_KEY_HEADER, InternalApi, InternalAuth } from "../contract/internal"

const sameSecret = (a: string, b: string): boolean => {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}

/** Server side of {@link InternalAuth}: requests must carry the shared `INTERNAL_KEY`. */
export const InternalAuthLive = Layer.effect(
  InternalAuth,
  Effect.gen(function* () {
    const expected = yield* Config.Redacted("INTERNAL_KEY")
    return InternalAuth.of({
      key: (httpEffect, { credential }) =>
        sameSecret(Redacted.value(credential), Redacted.value(expected))
          ? httpEffect
          : Effect.fail(new Unauthorized({ message: "Invalid internal key" })),
    })
  }),
)

/** Client side of {@link InternalAuth}: adds the shared `INTERNAL_KEY` to every request of an internal API. */
export const InternalAuthClient = Layer.unwrap(
  Effect.gen(function* () {
    const key = yield* Config.Redacted("INTERNAL_KEY")
    return HttpApiMiddleware.layerClient(InternalAuth, ({ next, request }) =>
      next(HttpClientRequest.setHeader(request, INTERNAL_KEY_HEADER, Redacted.value(key))),
    )
  }),
)

/** Typed client for the auth service's internal API (`AUTH_URL`). */
export class InternalClient extends Context.Service<InternalClient, HttpApiClient.ForApi<typeof InternalApi>>()(
  "@mosaik/auth/InternalClient",
) {
  static readonly layer = Layer.effect(
    InternalClient,
    Effect.gen(function* () {
      const baseUrl = yield* Config.URL("AUTH_URL")
      return yield* HttpApiClient.make(InternalApi, { baseUrl })
    }),
  ).pipe(Layer.provide([InternalAuthClient, FetchHttpClient.layer]))
}
