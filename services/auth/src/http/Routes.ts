import { JWKS_PATH } from "@mosaik/auth/contract"
import { Effect, Layer } from "effect"
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/http"
import { BetterAuth } from "../BetterAuth"
import { SigningKeys } from "../SigningKeys"

/** Better Auth owns everything under `/api/auth/*` that our identity API does not define. */
const BetterAuthRoute = HttpRouter.use(
  Effect.fn(function* (router) {
    const auth = yield* BetterAuth
    yield* router.add(
      "*",
      "/api/auth/*",
      Effect.fn("BetterAuth.handle")(function* (request: HttpServerRequest.HttpServerRequest) {
        const webRequest = yield* HttpServerRequest.toWeb(request).pipe(Effect.orDie)
        const response = yield* Effect.promise(() => auth.handler(webRequest))
        return HttpServerResponse.fromWeb(response)
      }),
    )
  }),
)

/** Public keys for verifying internal tokens (apps fetch and cache them). */
const JwksRoute = HttpRouter.use(
  Effect.fn(function* (router) {
    const keys = yield* SigningKeys
    yield* router.add("GET", JWKS_PATH, HttpServerResponse.jsonUnsafe(keys.jwks))
  }),
)

export const RawRoutes = Layer.mergeAll(BetterAuthRoute, JwksRoute)
