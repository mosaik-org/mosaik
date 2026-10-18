import { PgClient } from "@effect/sql-pg"
import { InboxEvent, type InboxItem } from "@mosaik/notifications/contract"
import { Context, Effect, Layer, PubSub, Queue, Schedule, Schema, Stream } from "effect"
import { Inbox } from "./Inbox"

/** Postgres channel; every instance listens, so browsers connected anywhere get the event. */
const CHANNEL = "mosaik_inbox"

const Signal = Schema.Union([
  /** A notification created inbox items. */
  Schema.Struct({ message: Schema.Number }),
  /** A user read items: their unread count changed. */
  Schema.Struct({ read: Schema.String }),
])
const encodeSignal = Schema.encodeSync(Schema.fromJsonString(Signal))
const decodeSignal = Schema.decodeUnknownEffect(Schema.fromJsonString(Signal))

interface Update {
  readonly userId: string
  readonly item: InboxItem | null
}

/** Live inbox updates for connected browsers, across instances (Postgres LISTEN/NOTIFY). */
export class Fanout extends Context.Service<
  Fanout,
  {
    /** Announces the inbox items of a new notification. */
    announce(messageId: number): Effect.Effect<void>
    /** Announces that a user's unread count changed. */
    announceRead(userId: string): Effect.Effect<void>
    /** The user's unread count now, then an event for every change. */
    subscribe(userId: string): Stream.Stream<InboxEvent>
  }
>()("@mosaik/notifications-service/Fanout") {
  static readonly layer = Layer.effect(
    Fanout,
    Effect.gen(function* () {
      const sql = yield* PgClient.PgClient
      const inbox = yield* Inbox
      const updates = yield* PubSub.unbounded<Update>()

      const handle = (payload: string) =>
        Effect.gen(function* () {
          const signal = yield* decodeSignal(payload)
          if ("read" in signal) return yield* PubSub.publish(updates, { userId: signal.read, item: null })
          const items = yield* inbox.itemsForMessage(signal.message)
          yield* PubSub.publishAll(updates, items)
        }).pipe(Effect.catchCause((cause) => Effect.logWarning("Invalid inbox signal", cause)))

      const listen = Effect.gen(function* () {
        const notifications = yield* sql.listen(CHANNEL)
        while (true) {
          const notification = yield* Queue.take(notifications)
          yield* handle(notification.payload)
        }
      }).pipe(Effect.scoped)

      yield* listen.pipe(
        Effect.tapCause((cause) => Effect.logWarning("Inbox listener stopped, reconnecting", cause)),
        Effect.retry(Schedule.spaced("5 seconds")),
        Effect.forkScoped,
      )

      const notify = (signal: typeof Signal.Type) => sql.notify(CHANNEL, encodeSignal(signal)).pipe(Effect.orDie)

      return Fanout.of({
        announce: (messageId) => notify({ message: messageId }),
        announceRead: (userId) => notify({ read: userId }),
        subscribe: (userId) =>
          Stream.unwrap(
            Effect.gen(function* () {
              const unread = yield* inbox.unread(userId)
              const changes = Stream.fromPubSub(updates).pipe(
                Stream.filter((update) => update.userId === userId),
                Stream.mapEffect((update) =>
                  inbox
                    .unread(userId)
                    .pipe(Effect.map((count) => new InboxEvent({ unread: count, item: update.item }))),
                ),
              )
              return Stream.concat(Stream.make(new InboxEvent({ unread, item: null })), changes)
            }),
          ),
      })
    }),
  )
}
