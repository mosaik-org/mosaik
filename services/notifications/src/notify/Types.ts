import { PgClient } from "@effect/sql-pg"
import { BadRequest, NotificationResolver, PersonalChannel } from "@mosaik/core"
import type { NotificationTypesPayload } from "@mosaik/notifications/contract"
import { Context, Effect, Layer, type Option, Schema } from "effect"
import { SqlSchema } from "effect/sql"

const TypeRow = Schema.Struct({
  key: Schema.String,
  source: Schema.String,
  description: Schema.String,
  defaultChannels: Schema.Array(PersonalChannel),
  action: Schema.Boolean,
  resolvedBy: NotificationResolver,
})
export type NotificationType = typeof TypeRow.Type

/** Notification types declared in app manifests, registered when each backend starts. */
export class NotificationTypes extends Context.Service<
  NotificationTypes,
  {
    register(payload: NotificationTypesPayload): Effect.Effect<void, BadRequest>
    get(key: string): Effect.Effect<Option.Option<NotificationType>>
    /** Current (not stale) types. */
    readonly list: Effect.Effect<ReadonlyArray<NotificationType>>
  }
>()("@mosaik/notifications-service/NotificationTypes") {
  static readonly layer = Layer.effect(
    NotificationTypes,
    Effect.gen(function* () {
      const sql = yield* PgClient.PgClient
      const columns = sql.literal("key, source, description, default_channels, action, resolved_by")

      const findByKey = SqlSchema.findOneOption({
        Request: Schema.String,
        Result: TypeRow,
        execute: (key) => sql`SELECT ${columns} FROM notification_types WHERE key = ${key} AND NOT stale`,
      })
      const findAll = SqlSchema.findAll({
        Request: Schema.Void,
        Result: TypeRow,
        execute: () => sql`
          SELECT ${columns} FROM notification_types
          WHERE NOT stale ORDER BY source, key
        `,
      })

      return NotificationTypes.of({
        register: Effect.fn("NotificationTypes.register")(function* (payload: NotificationTypesPayload) {
          const foreign = payload.types.filter((type) => !type.key.startsWith(`${payload.source}:`))
          if (foreign.length > 0) {
            return yield* new BadRequest({
              message: `Notification types must be namespaced with "${payload.source}:" (${foreign.map((t) => t.key).join(", ")})`,
            })
          }
          yield* sql
            .withTransaction(
              Effect.gen(function* () {
                for (const type of payload.types) {
                  yield* sql`
                    INSERT INTO notification_types ${sql.insert({
                      key: type.key,
                      source: payload.source,
                      description: type.description,
                      defaultChannels: sql.json(type.defaultChannels),
                      action: type.action,
                      resolvedBy: type.resolvedBy,
                    })}
                    ON CONFLICT (key) DO UPDATE SET
                      description = excluded.description, default_channels = excluded.default_channels,
                      action = excluded.action, resolved_by = excluded.resolved_by,
                      stale = false, updated_at = now()
                  `
                }
                const declared = payload.types.map((type) => type.key)
                yield* sql`
                  UPDATE notification_types SET stale = true, updated_at = now()
                  WHERE source = ${payload.source} AND NOT stale
                    AND ${declared.length > 0 ? sql`key NOT IN ${sql.in(declared)}` : sql.literal("true")}
                `
              }),
            )
            .pipe(Effect.orDie)
          if (payload.types.length > 0) {
            yield* Effect.logInfo(`Registered notification types of "${payload.source}"`, {
              types: payload.types.map((type) => type.key),
            })
          }
        }),

        get: (key) => findByKey(key).pipe(Effect.orDie),
        list: findAll().pipe(Effect.orDie),
      })
    }),
  )
}
