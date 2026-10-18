import { PgClient } from "@effect/sql-pg"
import type { PersonalChannel } from "@mosaik/core"
import type { ChannelSettings } from "@mosaik/notifications/contract"
import { Context, Effect, Layer, Schema } from "effect"
import { SqlSchema } from "effect/sql"

/** A user's explicit choices for one type; channels they never touched are absent. */
export type Choices = Partial<Record<PersonalChannel, boolean>>

/** Whether a channel is on: the user's explicit choice, else the type's default. */
export const isEnabled = (defaults: ReadonlyArray<PersonalChannel>, choices: Choices, channel: PersonalChannel) =>
  choices[channel] ?? defaults.includes(channel)

export const effectiveSettings = (defaults: ReadonlyArray<PersonalChannel>, choices: Choices): ChannelSettings => ({
  inApp: isEnabled(defaults, choices, "inApp"),
  email: isEnabled(defaults, choices, "email"),
  slack: isEnabled(defaults, choices, "slack"),
})

const PreferenceRow = Schema.Struct({
  userId: Schema.String,
  typeKey: Schema.String,
  channel: Schema.Literals(["inApp", "email", "slack"]),
  enabled: Schema.Boolean,
})

const group = (rows: ReadonlyArray<typeof PreferenceRow.Type>, by: (row: typeof PreferenceRow.Type) => string) => {
  const result = new Map<string, Choices>()
  for (const row of rows) result.set(by(row), { ...result.get(by(row)), [row.channel]: row.enabled })
  return result
}

/** Per-user, per-type channel choices. */
export class Preferences extends Context.Service<
  Preferences,
  {
    /** Choices of these users for one type, by user id. */
    forType(typeKey: string, userIds: ReadonlyArray<string>): Effect.Effect<ReadonlyMap<string, Choices>>
    /** Choices of one user, by type key. */
    forUser(userId: string): Effect.Effect<ReadonlyMap<string, Choices>>
    set(userId: string, typeKey: string, channel: PersonalChannel, enabled: boolean): Effect.Effect<void>
  }
>()("@mosaik/notifications-service/Preferences") {
  static readonly layer = Layer.effect(
    Preferences,
    Effect.gen(function* () {
      const sql = yield* PgClient.PgClient

      const byType = SqlSchema.findAll({
        Request: Schema.Struct({ typeKey: Schema.String, userIds: Schema.Array(Schema.String) }),
        Result: PreferenceRow,
        execute: ({ typeKey, userIds }) => sql`
          SELECT user_id, type_key, channel, enabled FROM preferences
          WHERE type_key = ${typeKey} AND user_id IN ${sql.in(userIds)}
        `,
      })
      const byUser = SqlSchema.findAll({
        Request: Schema.String,
        Result: PreferenceRow,
        execute: (userId) => sql`SELECT user_id, type_key, channel, enabled FROM preferences WHERE user_id = ${userId}`,
      })

      return Preferences.of({
        forType: (typeKey, userIds) =>
          userIds.length === 0
            ? Effect.succeed(new Map())
            : byType({ typeKey, userIds }).pipe(
                Effect.map((rows) => group(rows, (row) => row.userId)),
                Effect.orDie,
              ),
        forUser: (userId) =>
          byUser(userId).pipe(
            Effect.map((rows) => group(rows, (row) => row.typeKey)),
            Effect.orDie,
          ),
        set: (userId, typeKey, channel, enabled) =>
          sql`
            INSERT INTO preferences ${sql.insert({ userId, typeKey, channel, enabled })}
            ON CONFLICT (user_id, type_key, channel) DO UPDATE SET enabled = excluded.enabled
          `.pipe(Effect.asVoid, Effect.orDie),
      })
    }),
  )
}
