import { AccessChange, IdentityApi, SessionInfo } from "@mosaik/auth/contract"
import { Live } from "@mosaik/server"
import { Effect, Option, Stream } from "effect"
import { HttpServerRequest } from "effect/http"
import { HttpApiBuilder } from "effect/http-api"
import { AccessFeed } from "../AccessFeed"
import { BetterAuth } from "../BetterAuth"
import { Access } from "../rbac/Access"

export const IdentityHandlers = HttpApiBuilder.group(
  IdentityApi,
  "identity",
  Effect.fn(function* (handlers) {
    const auth = yield* BetterAuth
    const access = yield* Access
    const feed = yield* AccessFeed

    return handlers.handleAll({
      session: Effect.fn("Identity.session")(function* () {
        const request = yield* HttpServerRequest.HttpServerRequest
        const user = yield* auth.getSessionUser(new Headers(request.headers)).pipe(Effect.orDie)
        const principal = yield* access.principalFor(user)
        return new SessionInfo({ principal, providers: auth.providers })
      }),
      // The caller is who they were when connecting: the browser connects again when that changes.
      live: Effect.fn("Identity.live")(function* () {
        const request = yield* HttpServerRequest.HttpServerRequest
        const user = Option.getOrNull(
          Option.map(yield* auth.getSessionUser(new Headers(request.headers)).pipe(Effect.orDie), (user) => user.id),
        )
        const theirs = feed.changes.pipe(Stream.filter((change) => change.user === null || change.user === user))
        return yield* Live.eventStream(AccessChange, theirs, { heartbeat: "20 seconds" })
      }),
    })
  }),
)
