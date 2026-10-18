import { PgClient } from "@effect/sql-pg"
import { BadRequest } from "@mosaik/core"
import { RoutingRule } from "@mosaik/notifications/contract"
import { Context, Effect, Layer, Schema } from "effect"
import { SqlSchema } from "effect/sql"

const KEY = /^[a-z][a-z0-9-]*:[a-z][a-z0-9.-]*$/

const RuleRow = Schema.Struct({
  key: Schema.String,
  category: Schema.Literals(["notification", "message"]),
  description: Schema.NullOr(Schema.String),
  targets: Schema.Array(Schema.String),
})

/**
 * Admin routing: a notification type or message kind (`<source>:<name>`) is also
 * posted to these targets, in addition to whoever it is addressed to.
 */
export class Routes extends Context.Service<
  Routes,
  {
    targetsFor(key: string): Effect.Effect<ReadonlyArray<string>>
    /** Every known type and message kind with its targets. */
    readonly list: Effect.Effect<ReadonlyArray<RoutingRule>>
    set(key: string, targets: ReadonlyArray<string>): Effect.Effect<RoutingRule, BadRequest>
  }
>()("@mosaik/notifications-service/Routes") {
  static readonly layer = Layer.effect(
    Routes,
    Effect.gen(function* () {
      const sql = yield* PgClient.PgClient

      const findRules = SqlSchema.findAll({
        Request: Schema.Void,
        Result: RuleRow,
        execute: () => sql`
          WITH keys AS (
            SELECT key, 'notification' AS category, description FROM notification_types WHERE NOT stale
            UNION
            SELECT DISTINCT source || ':' || kind, 'message', NULL FROM messages
            WHERE category = 'message' AND kind IS NOT NULL
            UNION
            SELECT DISTINCT r.key, 'message', NULL FROM routes r
            WHERE NOT EXISTS (SELECT 1 FROM notification_types t WHERE t.key = r.key)
          )
          SELECT k.key, k.category, k.description,
            COALESCE((SELECT jsonb_agg(r.target_id ORDER BY r.target_id) FROM routes r WHERE r.key = k.key), '[]') AS targets
          FROM keys k
          ORDER BY k.key
        `,
      })

      const targetsFor = (key: string) =>
        sql<{ targetId: string }>`SELECT target_id FROM routes WHERE key = ${key} ORDER BY target_id`.pipe(
          Effect.map((rows) => rows.map((row) => row.targetId)),
          Effect.orDie,
        )

      const list = findRules().pipe(
        Effect.map((rows) => {
          // A message kind seen in messages may also be routed already: keep one rule per key.
          const byKey = new Map<string, RoutingRule>()
          for (const row of rows) {
            const existing = byKey.get(row.key)
            if (existing === undefined || existing.category === "message") byKey.set(row.key, new RoutingRule(row))
          }
          return [...byKey.values()]
        }),
        Effect.orDie,
      )

      return Routes.of({
        targetsFor,
        list,

        set: Effect.fn("Routes.set")(function* (key: string, targets: ReadonlyArray<string>) {
          if (!KEY.test(key))
            return yield* new BadRequest({ message: `Invalid key "${key}" (expected <source>:<name>)` })
          const unique = [...new Set(targets)]
          if (unique.length > 0) {
            const existing = yield* sql<{ id: string }>`SELECT id FROM targets WHERE id IN ${sql.in(unique)}`.pipe(
              Effect.orDie,
            )
            const missing = unique.filter((id) => !existing.some((row) => row.id === id))
            if (missing.length > 0) return yield* new BadRequest({ message: `Unknown targets: ${missing.join(", ")}` })
          }
          yield* sql
            .withTransaction(
              Effect.gen(function* () {
                yield* sql`DELETE FROM routes WHERE key = ${key}`
                if (unique.length > 0) {
                  yield* sql`INSERT INTO routes ${sql.insert(unique.map((targetId) => ({ key, targetId })))}`
                }
              }),
            )
            .pipe(Effect.orDie)
          const rules = yield* list
          return (
            rules.find((rule) => rule.key === key) ??
            new RoutingRule({ key, category: "message", description: null, targets: unique })
          )
        }),
      })
    }),
  )
}
