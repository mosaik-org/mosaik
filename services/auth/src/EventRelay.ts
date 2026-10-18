import { PgClient } from "@effect/sql-pg"
import { SourceEvent } from "@mosaik/platform/contract"
import { DateTime, Duration, Effect, Layer, Option, Queue, Schedule, Schema } from "effect"
import { SqlSchema } from "effect/sql"
import { PlatformClient } from "./PlatformClient"
import { Access } from "./rbac/Access"

/** Notified by the outbox triggers (see the `0001_initial` migration). */
const CHANNEL = "mosaik_event_outbox"
const BATCH = 200
/** Also look without a signal now and then (a notification lost while reconnecting). */
const SWEEP_EVERY = Duration.seconds(30)

const OutboxRow = Schema.Struct({
  id: Schema.BigInt,
  eventId: Schema.String,
  type: Schema.Literals(["user.created", "user.deleted", "user.access_changed"]),
  userId: Schema.String,
  data: Schema.Json,
  occurredAt: Schema.DateTimeUtcFromDate,
})
type OutboxRow = typeof OutboxRow.Type

/** Events are built from the outbox in their JSON form, then checked against the contract. */
export const decodeEvents = Schema.decodeUnknownEffect(Schema.toCodecJson(Schema.Array(SourceEvent)))

/**
 * Access changes carry the user's grants as they are when relayed, so only the last
 * one per user in a batch is sent (one role change can record several).
 */
export const latestAccessChanges = <Row extends { readonly type: string; readonly userId: string }>(
  rows: ReadonlyArray<Row>,
): ReadonlyArray<Row> => {
  const last = new Map<string, Row>()
  for (const row of rows) if (row.type === "user.access_changed") last.set(row.userId, row)
  return rows.filter((row) => row.type !== "user.access_changed" || last.get(row.userId) === row)
}

/**
 * Hands the platform events about users recorded in the outbox, in order. An event is
 * removed once the platform has it; the platform ignores ones it already has (by id),
 * so sending again after a failure is safe.
 */
export const EventRelay = Layer.effectDiscard(
  Effect.gen(function* () {
    const sql = yield* PgClient.PgClient
    const access = yield* Access
    const platform = yield* PlatformClient
    const wake = yield* Queue.sliding<void>(1)

    const pending = SqlSchema.findAll({
      Request: Schema.Void,
      Result: OutboxRow,
      execute: () => sql`
        SELECT id, event_id, type, user_id, data, occurred_at FROM event_outbox ORDER BY id LIMIT ${BATCH}
      `,
    })

    const toEvents = Effect.fn(function* (rows: ReadonlyArray<OutboxRow>) {
      const events: Array<unknown> = []
      for (const row of latestAccessChanges(rows)) {
        const base = { id: row.eventId, type: row.type, occurredAt: DateTime.formatIso(row.occurredAt) }
        if (row.type !== "user.access_changed") {
          events.push({ ...base, data: row.data })
          continue
        }
        // Deleted since: the user gets `user.deleted` instead.
        const grants = yield* access.grantsOf(row.userId)
        if (Option.isSome(grants)) events.push({ ...base, data: { userId: row.userId, grants: grants.value } })
      }
      return events
    })

    /** Relays one batch; returns whether there may be more. */
    const relay = Effect.gen(function* () {
      const rows = yield* pending()
      if (rows.length === 0) return false
      const events = yield* toEvents(rows)
      if (events.length > 0) {
        yield* platform.events.publish({ payload: { events: yield* decodeEvents(events) } })
      }
      yield* sql`DELETE FROM event_outbox WHERE id IN ${sql.in(rows.map((row) => row.id))}`
      yield* Effect.logDebug("Relayed events", { events: events.length })
      return rows.length === BATCH
    }).pipe(Effect.withSpan("EventRelay.relay"))

    const drain: Effect.Effect<void, unknown> = relay.pipe(Effect.flatMap((more) => (more ? drain : Effect.void)))

    // Signals from the triggers; reconnects with the connection.
    yield* Effect.gen(function* () {
      const notifications = yield* sql.listen(CHANNEL)
      yield* Queue.offer(wake, undefined)
      while (true) {
        yield* Queue.take(notifications)
        yield* Queue.offer(wake, undefined)
      }
    }).pipe(
      Effect.scoped,
      Effect.tapCause((cause) => Effect.logWarning("Outbox listener stopped, reconnecting", cause)),
      Effect.retry(Schedule.spaced("5 seconds")),
      Effect.forkScoped,
    )

    yield* Queue.take(wake).pipe(
      Effect.timeoutOption(SWEEP_EVERY),
      Effect.andThen(drain),
      Effect.tapError((error) => Effect.logWarning("Could not relay events to the platform, retrying", error)),
      Effect.retry(Schedule.min([Schedule.exponential("1 second"), Schedule.spaced("30 seconds")])),
      Effect.forever,
      Effect.forkScoped,
    )
  }),
)
