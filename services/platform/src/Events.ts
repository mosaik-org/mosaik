import { PgClient } from "@effect/sql-pg"
import { isGranted, PlatformEventType, scopeGrants } from "@mosaik/core"
import {
  AppEvent,
  AppEventBatch,
  type AppManifest,
  EventConsumer,
  MAX_EVENTS_WAIT_SECONDS,
  SourceEvent,
} from "@mosaik/platform/contract"
import {
  Context,
  DateTime,
  Duration,
  Effect,
  Layer,
  Option,
  PubSub,
  Queue,
  Schedule,
  Schema,
  SchemaTransformation,
} from "effect"
import { SqlSchema } from "effect/sql"
import { PlatformConfig } from "./PlatformConfig"

/** Postgres channel, notified when events are recorded, to wake apps waiting for them. */
const CHANNEL = "mosaik_events"
/** Serializes recording, so positions are committed in order and no app skips one in flight. */
const RECORD_LOCK = 0x64617368
const BATCH = 100
const PRUNE_EVERY = Duration.hours(1)

/** A Postgres `bigint` (read as a JS `BigInt`) as a number: positions stay far below 2^53. */
const Position = Schema.BigInt.pipe(
  Schema.decodeTo(Schema.Number, SchemaTransformation.transform({ decode: Number, encode: BigInt })),
)

const EventRow = Schema.Struct({
  seq: Position,
  id: Schema.String,
  type: PlatformEventType,
  occurredAt: Schema.DateTimeUtcFromDate,
  data: Schema.Json,
})
export type EventRow = typeof EventRow.Type

const ConsumerRow = Schema.Struct({
  consumer: Schema.String,
  position: Position,
  lastError: Schema.NullOr(Schema.String),
  errorAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
  polledAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
})

const encodeSource = Schema.encodeSync(SourceEvent)

const toEvent = (row: EventRow, data: Schema.Json = row.data) =>
  new AppEvent({ id: row.id, position: row.seq, type: row.type, occurredAt: row.occurredAt, data })

/** What an app sees of an event: grants are narrowed to the app, like in its tokens. */
export const forApp = (row: EventRow, manifest: AppManifest): AppEvent => {
  const data =
    row.type === "user.access_changed"
      ? (() => {
          const { userId, grants } = row.data as { userId: string; grants: ReadonlyArray<string> }
          return {
            userId,
            hasAccess: isGranted(grants, manifest.access),
            grants: [...scopeGrants(grants, manifest.id)],
          }
        })()
      : row.data
  return toEvent(row, data)
}

/** Who receives events: an app (following its manifest) or a platform service. */
export interface Subscriber {
  /** The app's id, or `service:<name>`. */
  readonly id: string
  readonly types: ReadonlyArray<PlatformEventType>
  /** What the subscriber sees of an event. */
  readonly view: (row: EventRow) => AppEvent
}

export const appSubscriber = (appId: string, manifest: AppManifest): Subscriber => ({
  id: appId,
  types: manifest.events,
  view: (row) => forApp(row, manifest),
})

/** How a platform service is known among subscribers (app ids never contain `:`). */
export const serviceConsumer = (service: string) => `service:${service}`

/** Platform services are trusted with every event as recorded. */
export const serviceSubscriber = (service: string, types: ReadonlyArray<PlatformEventType>): Subscriber => ({
  id: serviceConsumer(service),
  types,
  view: (row) => toEvent(row),
})

/**
 * Platform events: one ordered log that platform services record into, and for every
 * subscriber (an app, following its manifest, or a platform service such as the Portal) the
 * position up to which it has handled them. Subscribers fetch events (waiting for new ones)
 * and acknowledge them.
 */
export class Events extends Context.Service<
  Events,
  {
    record(events: ReadonlyArray<SourceEvent>): Effect.Effect<void>
    /** Starts delivering (from now on), or stops when the subscriber wants no events. */
    follow(subscriber: Subscriber): Effect.Effect<void>
    /** The next events after the subscriber's position, waiting up to `wait` for new ones. */
    fetch(subscriber: Subscriber, wait: Duration.Duration): Effect.Effect<AppEventBatch>
    acknowledge(consumer: string, position: number, error: string | null): Effect.Effect<void>
    /** Delivery status of these subscribers, by id (for those that receive events). */
    status(subscribers: ReadonlyArray<Subscriber>): Effect.Effect<ReadonlyMap<string, EventConsumer>>
    /** Moves the subscriber past the next event it would get (the one it keeps failing on). */
    skip(subscriber: Subscriber): Effect.Effect<void>
    /** Stops delivering and forgets the position. */
    forget(consumer: string): Effect.Effect<void>
  }
>()("@mosaik/platform-service/Events") {
  static readonly layer = Layer.effect(
    Events,
    Effect.gen(function* () {
      const sql = yield* PgClient.PgClient
      const config = yield* PlatformConfig
      const recorded = yield* PubSub.sliding<void>(1)

      yield* Effect.gen(function* () {
        const notifications = yield* sql.listen(CHANNEL)
        while (true) {
          yield* Queue.take(notifications)
          yield* PubSub.publish(recorded, undefined)
        }
      }).pipe(
        Effect.scoped,
        Effect.tapCause((cause) => Effect.logWarning("Event listener stopped, reconnecting", cause)),
        Effect.retry(Schedule.spaced("5 seconds")),
        Effect.forkScoped,
      )

      /** The last recorded position, even after retention emptied the log. */
      const head = sql`(SELECT GREATEST(COALESCE(MAX(seq), 0), (SELECT pruned_through FROM event_log)) FROM events)`

      const findEvents = SqlSchema.findAll({
        Request: Schema.Struct({ after: Schema.Number, types: Schema.Array(Schema.String) }),
        Result: EventRow,
        execute: ({ after, types }) => sql`
          SELECT seq, id, type, occurred_at, data FROM events
          WHERE seq > ${after} AND type IN ${sql.in(types)}
          ORDER BY seq LIMIT ${BATCH}
        `,
      })
      const findConsumers = SqlSchema.findAll({
        Request: Schema.Void,
        Result: ConsumerRow,
        execute: () => sql`SELECT consumer, position, last_error, error_at, polled_at FROM event_consumers`,
      })

      const forget = (consumer: string) =>
        sql`DELETE FROM event_consumers WHERE consumer = ${consumer}`.pipe(Effect.asVoid, Effect.orDie)

      const follow = (subscriber: Subscriber) =>
        subscriber.types.length > 0
          ? sql`
              INSERT INTO event_consumers (consumer, position) VALUES (${subscriber.id}, ${head})
              ON CONFLICT (consumer) DO NOTHING
            `.pipe(Effect.asVoid, Effect.orDie)
          : forget(subscriber.id)

      /**
       * Reads the app's next events. When none match, the position moves to the head
       * (read in the same statement), so the events in between are not scanned again.
       */
      const next = Effect.fn("Events.next")(function* (subscriber: Subscriber) {
        const [state] = yield* sql<{ position: bigint; prunedThrough: bigint; head: bigint }>`
          UPDATE event_consumers SET polled_at = now() WHERE consumer = ${subscriber.id}
          RETURNING position, (SELECT pruned_through FROM event_log) AS pruned_through, ${head} AS head
        `
        if (state === undefined) return { events: [], missed: false }
        let position = Number(state.position)
        const missed = Number(state.prunedThrough) > position
        if (missed) {
          position = Number(state.prunedThrough)
          yield* Effect.logWarning(`"${subscriber.id}" missed events removed by retention`)
        }
        const rows = yield* findEvents({ after: position, types: subscriber.types })
        const settled = rows.length === 0 ? Number(state.head) : position
        if (settled !== Number(state.position)) {
          yield* sql`UPDATE event_consumers SET position = GREATEST(position, ${settled}) WHERE consumer = ${subscriber.id}`
        }
        return { events: rows.map(subscriber.view), missed }
      }, Effect.orDie)

      const prune = Effect.gen(function* () {
        const cutoff = new Date(Date.now() - Duration.toMillis(config.eventRetention))
        const [row] = yield* sql<{ removed: number }>`
          WITH removed AS (DELETE FROM events WHERE recorded_at < ${cutoff} RETURNING seq),
          updated AS (
            UPDATE event_log SET pruned_through = GREATEST(pruned_through, (SELECT MAX(seq) FROM removed))
            WHERE EXISTS (SELECT 1 FROM removed)
          )
          SELECT count(*)::int AS removed FROM removed
        `
        if ((row?.removed ?? 0) > 0) yield* Effect.logInfo("Removed old events", { removed: row?.removed })
      })
      yield* prune.pipe(
        Effect.catchCause((cause) => Effect.logWarning("Could not remove old events", cause)),
        Effect.repeat(Schedule.spaced(PRUNE_EVERY)),
        Effect.forkScoped,
      )

      return Events.of({
        record: (events) =>
          events.length === 0
            ? Effect.void
            : sql
                .withTransaction(
                  Effect.gen(function* () {
                    yield* sql`SELECT pg_advisory_xact_lock(${RECORD_LOCK})`
                    const rows = events.map((event) => {
                      const encoded = encodeSource(event)
                      return {
                        id: event.id,
                        type: event.type,
                        occurredAt: DateTime.toDateUtc(event.occurredAt),
                        data: sql.json(encoded.data),
                      }
                    })
                    yield* sql`INSERT INTO events ${sql.insert(rows)} ON CONFLICT (id) DO NOTHING`
                    // In the transaction: delivered on commit, when the events are visible.
                    yield* sql`SELECT pg_notify(${CHANNEL}, '')`
                  }),
                )
                .pipe(Effect.orDie, Effect.withSpan("Events.record", { attributes: { count: events.length } })),

        follow,

        fetch: Effect.fn("Events.fetch")(function* (subscriber, wait) {
          if (subscriber.types.length === 0) return new AppEventBatch({ events: [], missed: false })
          yield* follow(subscriber)
          const batch = yield* Effect.scoped(
            Effect.gen(function* () {
              // Subscribe before reading, so an event recorded in between still wakes us.
              const subscription = yield* PubSub.subscribe(recorded)
              const first = yield* next(subscriber)
              if (first.events.length > 0 || first.missed || Duration.isZero(wait)) return first
              const woken = yield* PubSub.take(subscription).pipe(
                Effect.timeoutOption(Duration.min(wait, Duration.seconds(MAX_EVENTS_WAIT_SECONDS))),
              )
              return Option.isSome(woken) ? yield* next(subscriber) : first
            }),
          )
          return new AppEventBatch(batch)
        }),

        acknowledge: (consumer, position, error) =>
          sql`
            UPDATE event_consumers SET
              position = GREATEST(position, LEAST(${position}, ${head})),
              last_error = ${error},
              error_at = ${error === null ? null : new Date()}
            WHERE consumer = ${consumer}
          `.pipe(Effect.asVoid, Effect.orDie),

        status: Effect.fn("Events.status")(function* (subscribers) {
          const consumers = yield* findConsumers().pipe(Effect.orDie)
          const result = new Map<string, EventConsumer>()
          for (const consumer of consumers) {
            const subscriber = subscribers.find((candidate) => candidate.id === consumer.consumer)
            if (subscriber === undefined || subscriber.types.length === 0) continue
            const [row] = yield* sql<{ pending: number }>`
              SELECT count(*)::int AS pending FROM events
              WHERE seq > ${consumer.position} AND type IN ${sql.in(subscriber.types)}
            `.pipe(Effect.orDie)
            result.set(
              consumer.consumer,
              new EventConsumer({
                pending: row?.pending ?? 0,
                lastError: consumer.lastError,
                errorAt: consumer.errorAt,
                polledAt: consumer.polledAt,
              }),
            )
          }
          return result
        }),

        skip: (subscriber) =>
          subscriber.types.length === 0
            ? Effect.void
            : sql`
                UPDATE event_consumers c SET last_error = NULL, error_at = NULL, position = COALESCE(
                  (SELECT MIN(seq) FROM events WHERE seq > c.position AND type IN ${sql.in(subscriber.types)}),
                  c.position
                )
                WHERE consumer = ${subscriber.id}
              `.pipe(Effect.asVoid, Effect.orDie),

        forget,
      })
    }),
  )
}
