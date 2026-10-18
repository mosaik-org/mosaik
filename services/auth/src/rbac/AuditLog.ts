import { PgClient } from "@effect/sql-pg"
import type { AuditEventInput } from "@mosaik/auth/contract"
import { AuditPage, AuditRecord } from "@mosaik/auth/contract"
import { Context, Effect, Layer, Schema } from "effect"
import { SqlSchema } from "effect/sql"

const AuditRow = Schema.Struct({ ...AuditRecord.fields, at: Schema.DateTimeUtcFromDate })

export interface AuditQuery {
  readonly app?: string | undefined
  readonly before?: number | undefined
  readonly limit?: number | undefined
}

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200

/** Central, append-only audit log for every app (and the admin panel itself). */
export class AuditLog extends Context.Service<
  AuditLog,
  {
    record(event: AuditEventInput): Effect.Effect<void>
    list(query: AuditQuery): Effect.Effect<AuditPage>
  }
>()("@mosaik/auth-service/AuditLog") {
  static readonly layer = Layer.effect(
    AuditLog,
    Effect.gen(function* () {
      const sql = yield* PgClient.PgClient

      const findPage = SqlSchema.findAll({
        Request: Schema.Struct({
          app: Schema.optional(Schema.String),
          before: Schema.optional(Schema.Number),
          limit: Schema.Number,
        }),
        Result: AuditRow,
        execute: ({ app, before, limit }) => sql`
          SELECT id, at, app, action, target, actor_id, actor_email, details
          FROM audit_log
          WHERE ${sql.and([
            app === undefined ? sql.literal("true") : sql`app = ${app}`,
            before === undefined ? sql.literal("true") : sql`id < ${before}`,
          ])}
          ORDER BY id DESC
          LIMIT ${limit + 1}
        `,
      })

      return AuditLog.of({
        record: Effect.fn("AuditLog.record")(function* (event: AuditEventInput) {
          yield* sql`
            INSERT INTO audit_log ${sql.insert({
              app: event.app,
              action: event.action,
              target: event.target,
              actorId: event.actor?.id ?? null,
              actorEmail: event.actor?.email ?? null,
              details: sql.json(event.details),
            })}
          `.pipe(Effect.orDie)
        }),

        list: Effect.fn("AuditLog.list")(function* (query: AuditQuery) {
          const limit = Math.min(Math.max(query.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT)
          const rows = yield* findPage({ app: query.app, before: query.before, limit }).pipe(Effect.orDie)
          const entries = rows.slice(0, limit).map((row) => new AuditRecord(row))
          const last = entries.at(-1)
          return new AuditPage({ entries, nextCursor: rows.length > limit && last ? last.id : null })
        }),
      })
    }),
  )
}
