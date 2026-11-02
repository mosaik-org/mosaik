import { PgClient } from "@effect/sql-pg"
import { Conflict, NotFound } from "@mosaik/core"
import {
  type Content,
  Content as ContentSchema,
  DeliveryPage,
  DeliveryRecord,
  type DeliveryStatus,
} from "@mosaik/notifications/contract"
import { Array as Arr, Context, Duration, Effect, Layer, Option, Queue, Schema } from "effect"
import { SqlSchema } from "effect/sql"
import type { ChannelName, OutgoingDelivery } from "./channels/Channel"

/** How long a claimed delivery stays locked; after that another worker may pick it up again. */
const LEASE = Duration.minutes(2)

export interface Recipient {
  readonly channel: ChannelName
  /** E-mail address (`email`, `slack-user`) or target id (`target`). */
  readonly address: string
  readonly name: string | null
  /** When the destination was a Mosaik user. */
  readonly userId: string | null
}

export interface NewMessage {
  readonly category: "message" | "notification"
  readonly source: string
  /** Message kind or notification type name (without the source). */
  readonly kind: string | null
  readonly content: Content
  readonly idempotencyKey: string | null
  readonly recipients: ReadonlyArray<Recipient>
  /** Users who get it in their in-app inbox. */
  readonly inbox: ReadonlyArray<string>
}

export interface Enqueued {
  readonly id: number
  readonly deliveries: number
  readonly inbox: number
  /** Distinct users reached on any channel. */
  readonly users: number
  /** An earlier request with the same idempotency key created it. */
  readonly duplicate: boolean
}

export interface DeliveryQuery {
  readonly status?: DeliveryStatus | undefined
  readonly before?: number | undefined
  readonly limit?: number | undefined
}

const DeliveryRow = Schema.Struct({
  id: Schema.Number,
  messageId: Schema.Number,
  category: Schema.Literals(["message", "notification"]),
  source: Schema.String,
  kind: Schema.NullOr(Schema.String),
  channel: Schema.String,
  recipient: Schema.String,
  recipientName: Schema.NullOr(Schema.String),
  attempts: Schema.Number,
  content: ContentSchema,
})

const ExistingRow = Schema.Struct({
  id: Schema.Number,
  deliveries: Schema.Number,
  inbox: Schema.Number,
  users: Schema.Number,
})

const LogRow = Schema.Struct({
  ...DeliveryRecord.fields,
  createdAt: Schema.DateTimeUtcFromDate,
  sentAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
})

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200

/**
 * Messages, their deliveries and inbox items in Postgres. Deliveries are claimed with
 * `FOR UPDATE SKIP LOCKED` and a lease, so several workers (or instances) can share
 * the table and a crashed worker's deliveries are picked up again. Delivery is
 * at-least-once: a crash between sending and recording the result resends.
 */
export class Outbox extends Context.Service<
  Outbox,
  {
    /** Stores a message, its deliveries and inbox items atomically. Idempotent per (source, key). */
    enqueue(message: NewMessage): Effect.Effect<Enqueued>
    findByIdempotencyKey(source: string, key: string): Effect.Effect<Option.Option<Enqueued>>
    /** Locks up to `limit` due deliveries and counts the attempt. */
    claim(limit: number): Effect.Effect<ReadonlyArray<OutgoingDelivery>>
    markSent(id: number, providerId: string | null): Effect.Effect<void>
    /** Schedules a retry after `retryIn`, or marks the delivery failed for good. */
    markFailed(id: number, error: string, retryIn: Option.Option<Duration.Duration>): Effect.Effect<void>
    /** The delivery log, newest first. */
    log(query: DeliveryQuery): Effect.Effect<DeliveryPage>
    /** Sends a failed delivery again right away. */
    retry(id: number): Effect.Effect<void, NotFound | Conflict>
    /** Tells the worker that new deliveries are waiting. */
    readonly wake: Effect.Effect<void>
    /** Waits for {@link wake}. */
    readonly woken: Effect.Effect<void>
  }
>()("@mosaik/notifications-service/Outbox") {
  static readonly layer = Layer.effect(
    Outbox,
    Effect.gen(function* () {
      const sql = yield* PgClient.PgClient
      const signal = yield* Queue.dropping<void>(1)

      const findExisting = SqlSchema.findOneOption({
        Request: Schema.Struct({ source: Schema.String, key: Schema.String }),
        Result: ExistingRow,
        execute: ({ source, key }) => sql`
          SELECT m.id,
            (SELECT count(*)::int FROM deliveries d WHERE d.message_id = m.id) AS deliveries,
            (SELECT count(*)::int FROM inbox i WHERE i.message_id = m.id) AS inbox,
            (SELECT count(*)::int FROM (
              SELECT user_id FROM inbox WHERE message_id = m.id
              UNION SELECT recipient_user_id FROM deliveries WHERE message_id = m.id AND recipient_user_id IS NOT NULL
            ) u) AS users
          FROM messages m
          WHERE m.source = ${source} AND m.idempotency_key = ${key}
        `,
      })
      const duplicateOf = (source: string, key: string) =>
        findExisting({ source, key }).pipe(
          Effect.map(Option.map((row): Enqueued => ({ ...row, duplicate: true }))),
          Effect.orDie,
        )

      const claimDue = SqlSchema.findAll({
        Request: Schema.Number,
        Result: DeliveryRow,
        execute: (limit) => sql`
          WITH due AS (
            SELECT id FROM deliveries
            WHERE (status = 'pending' AND next_attempt_at <= now())
              OR (status = 'sending' AND locked_until < now())
            ORDER BY next_attempt_at
            LIMIT ${limit}
            FOR UPDATE SKIP LOCKED
          ), claimed AS (
            UPDATE deliveries d
            SET status = 'sending', attempts = d.attempts + 1,
              locked_until = now() + make_interval(secs => ${Duration.toSeconds(LEASE)})
            FROM due WHERE d.id = due.id
            RETURNING d.id, d.message_id, d.channel, d.recipient, d.recipient_name, d.attempts
          )
          SELECT c.*, m.category, m.source, m.kind, m.content
          FROM claimed c JOIN messages m ON m.id = c.message_id
          ORDER BY c.id
        `,
      })

      const findLog = SqlSchema.findAll({
        Request: Schema.Struct({
          status: Schema.optional(Schema.String),
          before: Schema.optional(Schema.Number),
          limit: Schema.Number,
        }),
        Result: LogRow,
        execute: ({ status, before, limit }) => sql`
          SELECT d.id, d.message_id, m.category, m.source, m.kind, m.content ->> 'title' AS title,
            d.channel, d.recipient, d.status, d.attempts, d.last_error, d.created_at, d.sent_at
          FROM deliveries d JOIN messages m ON m.id = d.message_id
          WHERE ${sql.and([
            status === undefined ? sql.literal("true") : sql`d.status = ${status}`,
            before === undefined ? sql.literal("true") : sql`d.id < ${before}`,
          ])}
          ORDER BY d.id DESC
          LIMIT ${limit + 1}
        `,
      })

      return Outbox.of({
        enqueue: Effect.fn("Outbox.enqueue")(function* (message: NewMessage) {
          return yield* sql
            .withTransaction(
              Effect.gen(function* () {
                const inserted = yield* sql<{ id: number }>`
                  INSERT INTO messages ${sql.insert({
                    category: message.category,
                    source: message.source,
                    kind: message.kind,
                    content: sql.json(message.content),
                    idempotencyKey: message.idempotencyKey,
                  })}
                  ON CONFLICT (source, idempotency_key) DO NOTHING
                  RETURNING id
                `
                const id = inserted[0]?.id
                if (id === undefined) {
                  // A concurrent request with the same idempotency key won.
                  const existing = yield* duplicateOf(message.source, message.idempotencyKey ?? "")
                  return Option.getOrThrow(existing)
                }
                if (Arr.isReadonlyArrayNonEmpty(message.recipients)) {
                  yield* sql`
                    INSERT INTO deliveries ${sql.insert(
                      Arr.map(message.recipients, (r) => ({
                        messageId: id,
                        channel: r.channel,
                        recipient: r.address,
                        recipientName: r.name,
                        recipientUserId: r.userId,
                      })),
                    )}
                    ON CONFLICT DO NOTHING
                  `
                }
                const inbox = [...new Set(message.inbox)]
                if (Arr.isReadonlyArrayNonEmpty(inbox)) {
                  yield* sql`
                    INSERT INTO inbox ${sql.insert(Arr.map(inbox, (userId) => ({ messageId: id, userId })))}
                    ON CONFLICT DO NOTHING
                  `
                }
                const users = new Set([
                  ...inbox,
                  ...message.recipients.flatMap((r) => (r.userId === null ? [] : [r.userId])),
                ])
                return {
                  id,
                  deliveries: message.recipients.length,
                  inbox: inbox.length,
                  users: users.size,
                  duplicate: false,
                }
              }),
            )
            .pipe(Effect.orDie)
        }),

        findByIdempotencyKey: duplicateOf,

        claim: (limit) =>
          claimDue(limit).pipe(
            Effect.map((rows): ReadonlyArray<OutgoingDelivery> => rows),
            Effect.orDie,
            Effect.withSpan("Outbox.claim"),
          ),

        markSent: (id, providerId) =>
          sql`
            UPDATE deliveries
            SET status = 'sent', sent_at = now(), provider_id = ${providerId}, locked_until = NULL, last_error = NULL
            WHERE id = ${id}
          `.pipe(Effect.asVoid, Effect.orDie),

        markFailed: (id, error, retryIn) =>
          Option.match(retryIn, {
            onNone: () => sql`
              UPDATE deliveries SET status = 'failed', locked_until = NULL, last_error = ${error} WHERE id = ${id}
            `,
            onSome: (delay) => sql`
              UPDATE deliveries
              SET status = 'pending', locked_until = NULL, last_error = ${error},
                next_attempt_at = now() + make_interval(secs => ${Duration.toSeconds(delay)})
              WHERE id = ${id}
            `,
          }).pipe(Effect.asVoid, Effect.orDie),

        log: Effect.fn("Outbox.log")(function* (query: DeliveryQuery) {
          const limit = Math.min(Math.max(query.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT)
          const rows = yield* findLog({ status: query.status, before: query.before, limit }).pipe(Effect.orDie)
          const entries = rows.slice(0, limit).map((row) => new DeliveryRecord(row))
          const last = entries.at(-1)
          return new DeliveryPage({ entries, nextCursor: rows.length > limit && last ? last.id : null })
        }),

        retry: Effect.fn("Outbox.retry")(function* (id: number) {
          const rows = yield* sql<{ status: string }>`SELECT status FROM deliveries WHERE id = ${id}`.pipe(Effect.orDie)
          const status = rows[0]?.status
          if (status === undefined) return yield* new NotFound({ resource: "delivery", id: String(id) })
          if (status !== "failed")
            return yield* new Conflict({ message: `Only failed deliveries can be retried (${status})` })
          yield* sql`
            UPDATE deliveries SET status = 'pending', next_attempt_at = now(), attempts = 0 WHERE id = ${id}
          `.pipe(Effect.orDie)
          yield* Queue.offer(signal, undefined)
        }),

        wake: Queue.offer(signal, undefined).pipe(Effect.asVoid),
        woken: Queue.take(signal),
      })
    }),
  )
}
