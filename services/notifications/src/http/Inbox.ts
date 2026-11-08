import { BadRequest, CurrentPrincipal, NotFound } from "@mosaik/core"
import { ChangedItems, InboxEvent, NotificationsApi } from "@mosaik/notifications/contract"
import { Live } from "@mosaik/server"
import { DateTime, Duration, Effect, Option, Stream } from "effect"
import { HttpApiBuilder } from "effect/http-api"
import { Fanout } from "../inbox/Fanout"
import { Inbox } from "../inbox/Inbox"

/**
 * Live streams end after a while so the browser reconnects with a fresh token
 * (and a user who lost access stops receiving updates).
 */
const LIVE_SESSION = Duration.minutes(5)

/** The logged-in user (the API's access control rejects anonymous requests). */
export const currentUser = Effect.gen(function* () {
  const principal = yield* CurrentPrincipal
  if (principal.user === null) return yield* Effect.die("AccessControlUsers lets only logged-in users in")
  return principal.user
})

export const currentUserId = Effect.map(currentUser, (user) => user.id)

export const InboxHandlers = HttpApiBuilder.group(
  NotificationsApi,
  "inbox",
  Effect.fn(function* (handlers) {
    const inbox = yield* Inbox
    const fanout = yield* Fanout

    /** Does something to the user's inbox, then tells their other tabs and devices. */
    const changing = <A, E, R>(change: (userId: string) => Effect.Effect<A, E, R>) =>
      Effect.gen(function* () {
        const userId = yield* currentUserId
        const result = yield* change(userId)
        yield* fanout.announceChanged([userId])
        return result
      })

    return handlers.handleAll({
      list: Effect.fn(function* ({ query }) {
        const userId = yield* currentUserId
        return yield* inbox.list(userId, query)
      }),

      get: Effect.fn(function* ({ params }) {
        const userId = yield* currentUserId
        const detail = yield* inbox.get(userId, params.id)
        if (Option.isNone(detail)) return yield* new NotFound({ resource: "inbox item", id: String(params.id) })
        return detail.value
      }),

      resolveInformation: Effect.fn(function* ({ payload }) {
        const user = yield* currentUser
        const ids = yield* inbox.resolveInformation({ id: user.id, name: user.name }, payload.source)
        if (ids.length > 0) yield* fanout.announceChanged([user.id])
        return new ChangedItems({ ids })
      }),

      markRead: ({ payload }) => changing((userId) => inbox.markRead(userId, payload.ids)),
      markAllRead: () => changing((userId) => inbox.markAllRead(userId)),

      resolve: Effect.fn(function* ({ payload }) {
        const user = yield* currentUser
        yield* inbox.resolve({ id: user.id, name: user.name }, payload.ids)
        yield* fanout.announceChanged([user.id])
      }),

      reopen: ({ payload }) => changing((userId) => inbox.reopen(userId, payload.ids)),

      snooze: Effect.fn(function* ({ payload }) {
        if (DateTime.isLessThanOrEqualTo(payload.until, yield* DateTime.now)) {
          return yield* new BadRequest({ message: "Snooze until a time still to come" })
        }
        yield* changing((userId) => inbox.snooze(userId, payload.ids, payload.until))
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
