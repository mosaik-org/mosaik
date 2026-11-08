import { PgClient } from "@effect/sql-pg"
import { InboxEvent, type InboxItem } from "@mosaik/notifications/contract"
import { Context, Effect, Layer, PubSub, Queue, Schedule, Schema, Stream } from "effect"
import { Inbox } from "./Inbox"

/** Postgres channel; every instance listens, so browsers connected anywhere get the event. */
const CHANNEL = "mosaik_inbox"

const Signal = Schema.Union([
  /** A notification added or updated inbox items. */
  Schema.Struct({ message: Schema.Number }),
  /** Items came back from snooze. */
  Schema.Struct({ items: Schema.Array(Schema.Number) }),
  /** These users' inboxes changed otherwise (read, resolved, snoozed): their counts did. */
  Schema.Struct({ changed: Schema.Array(Schema.String) }),
])
const encodeSignal = Schema.encodeSync(Schema.fromJsonString(Signal))
const decodeSignal = Schema.decodeUnknownEffect(Schema.fromJsonString(Signal))

interface Update {
  readonly userId: string
  /** An item to show as it comes; none for a change that only moved the counts. */
  readonly item: InboxItem | null
}

/**
 * Live inbox updates for connected browsers, across instances (Postgres LISTEN/NOTIFY). A payload is
 * limited to 8000 bytes, so signals name what changed and every instance reads it from the database.
 */
export class Fanout extends Context.Service<
  Fanout,
  {
    /** Announces the inbox items a new notification added or updated. */
    announce(messageId: number): Effect.Effect<void>
    /** Announces items that came back from snooze. */
    announceItems(ids: ReadonlyArray<number>): Effect.Effect<void>
    /** Announces that these users' inboxes changed otherwise. */
    announceChanged(userIds: ReadonlyArray<string>): Effect.Effect<void>
    /** The user's counts now, then an event for every change. */
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
          if ("changed" in signal) {
            return yield* PubSub.publishAll(
              updates,
              signal.changed.map((userId) => ({ userId, item: null })),
            )
          }
          const items =
            "message" in signal ? yield* inbox.itemsForMessage(signal.message) : yield* inbox.itemsByIds(signal.items)
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
      /** Large batches go in several signals, under the payload's limit. */
      const inChunks = <A>(all: ReadonlyArray<A>, signal: (chunk: ReadonlyArray<A>) => typeof Signal.Type) =>
        Effect.forEach(chunks(all, 200), (chunk) => notify(signal(chunk)), { discard: true })

      return Fanout.of({
        announce: (messageId) => notify({ message: messageId }),
        announceItems: (ids) => inChunks(ids, (items) => ({ items })),
        announceChanged: (userIds) => inChunks([...new Set(userIds)], (changed) => ({ changed })),
        subscribe: (userId) =>
          Stream.unwrap(
            Effect.gen(function* () {
              const counts = yield* inbox.counts(userId)
              const changes = Stream.fromPubSub(updates).pipe(
                Stream.filter((update) => update.userId === userId),
                Stream.mapEffect((update) =>
                  inbox.counts(userId).pipe(Effect.map((now) => new InboxEvent({ counts: now, item: update.item }))),
                ),
              )
              return Stream.concat(Stream.make(new InboxEvent({ counts, item: null })), changes)
            }),
          ),
      })
    }),
  )
}

const chunks = <A>(all: ReadonlyArray<A>, size: number): ReadonlyArray<ReadonlyArray<A>> =>
  Array.from({ length: Math.ceil(all.length / size) }, (_, i) => all.slice(i * size, (i + 1) * size))
