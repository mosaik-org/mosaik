import { CurrentPrincipal } from "@mosaik/core"
import { InboxEvent, NotificationsApi } from "@mosaik/notifications/contract"
import { Live } from "@mosaik/server"
import { Duration, Effect, Stream } from "effect"
import { HttpApiBuilder } from "effect/http-api"
import { Fanout } from "../inbox/Fanout"
import { Inbox } from "../inbox/Inbox"

/**
 * Live streams end after a while so the browser reconnects with a fresh token
 * (and a user who lost access stops receiving updates).
 */
const LIVE_SESSION = Duration.minutes(5)

/** The logged-in user (the API's access control rejects anonymous requests). */
export const currentUserId = Effect.gen(function* () {
  const principal = yield* CurrentPrincipal
  if (principal.user === null) return yield* Effect.die("AccessControlUsers lets only logged-in users in")
  return principal.user.id
})

export const InboxHandlers = HttpApiBuilder.group(
  NotificationsApi,
  "inbox",
  Effect.fn(function* (handlers) {
    const inbox = yield* Inbox
    const fanout = yield* Fanout

    return handlers.handleAll({
      list: Effect.fn(function* ({ query }) {
        const userId = yield* currentUserId
        return yield* inbox.list(userId, {
          before: query.before,
          limit: query.limit,
          unreadOnly: query.unread === "true",
        })
      }),

      markRead: Effect.fn(function* ({ payload }) {
        const userId = yield* currentUserId
        yield* inbox.markRead(userId, payload.ids)
        yield* fanout.announceRead(userId)
      }),

      markAllRead: Effect.fn(function* () {
        const userId = yield* currentUserId
        yield* inbox.markAllRead(userId)
        yield* fanout.announceRead(userId)
      }),

      live: Effect.fn(function* () {
        const userId = yield* currentUserId
        return yield* Live.eventStream(
          InboxEvent,
          fanout.subscribe(userId).pipe(Stream.interruptWhen(Effect.sleep(LIVE_SESSION))),
        )
      }),
    })
  }),
)
