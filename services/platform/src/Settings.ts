import { PgClient } from "@effect/sql-pg"
import {
  BadRequest,
  fromSettingDeclaration,
  NotFound,
  type PrincipalUser,
  type SettingDeclaration,
  settingProblem,
  settingValue,
} from "@mosaik/core"
import {
  AppSettingState,
  AppSettings,
  type AppSettingsChange,
  AppSettingsSnapshot,
  MAX_EVENTS_WAIT_SECONDS,
} from "@mosaik/platform/contract"
import { Context, Duration, Effect, Layer, Option, PubSub, Queue, Schedule, Schema } from "effect"
import { SqlSchema } from "effect/sql"
import { Apps } from "./Apps"

/** Postgres channel, notified with an app's id when its settings change, to wake the app waiting for them. */
const CHANNEL = "mosaik_settings"

const StoredRow = Schema.Struct({
  name: Schema.String,
  value: Schema.Json,
  changedBy: Schema.String,
  changedAt: Schema.DateTimeUtcFromDate,
})
export type StoredSetting = typeof StoredRow.Type

/** A change, as the audit log records it: the values the app read before and reads now. */
export interface SettingChange {
  readonly name: string
  readonly from: Schema.Json
  readonly to: Schema.Json
}

/** What the people who manage the app see: every declared setting, its value and who changed it. */
export const settingsView = (
  app: string,
  declarations: ReadonlyArray<SettingDeclaration>,
  stored: ReadonlyArray<StoredSetting>,
): AppSettings =>
  new AppSettings({
    app,
    settings: declarations.map((declaration) => {
      const row = stored.find((candidate) => candidate.name === declaration.name)
      const setting = fromSettingDeclaration(declaration)
      return new AppSettingState({
        declaration,
        value: settingValue(setting, row?.value) as Schema.Json,
        changed: row !== undefined,
        outdated: row !== undefined && settingProblem(setting, row.value) !== undefined,
        changedBy: row?.changedBy ?? null,
        changedAt: row?.changedAt ?? null,
      })
    }),
  })

/**
 * Checks a change against the app's declarations: the values to store, the settings going back
 * to their default, and what the app will read differently. A value equal to the default is
 * stored all the same: someone chose it, and it stays when a newer version changes the default.
 */
export const planChange = (
  declarations: ReadonlyArray<SettingDeclaration>,
  stored: ReadonlyArray<StoredSetting>,
  change: AppSettingsChange,
):
  | { readonly _tag: "Invalid"; readonly problems: ReadonlyArray<string> }
  | {
      readonly _tag: "Valid"
      readonly store: ReadonlyArray<{ readonly name: string; readonly value: Schema.Json }>
      readonly reset: ReadonlyArray<string>
      readonly changes: ReadonlyArray<SettingChange>
    } => {
  const problems: Array<string> = []
  const store: Array<{ name: string; value: Schema.Json }> = []
  const reset: Array<string> = []
  const changes: Array<SettingChange> = []
  for (const [name, value] of Object.entries(change.values)) {
    const declaration = declarations.find((candidate) => candidate.name === name)
    if (declaration === undefined) {
      problems.push(`${name}: the app has no such setting`)
      continue
    }
    const setting = fromSettingDeclaration(declaration)
    const row = stored.find((candidate) => candidate.name === name)
    if (value === null) {
      if (row === undefined) continue
      reset.push(name)
    } else {
      const problem = settingProblem(setting, value)
      if (problem !== undefined) {
        problems.push(`${declaration.label}: ${problem}`)
        continue
      }
      if (row !== undefined && JSON.stringify(row.value) === JSON.stringify(value)) continue
      store.push({ name, value })
    }
    const from = settingValue(setting, row?.value) as Schema.Json
    const to = (value === null ? setting.default : value) as Schema.Json
    if (JSON.stringify(from) !== JSON.stringify(to)) changes.push({ name, from, to })
  }
  return problems.length > 0 ? { _tag: "Invalid", problems } : { _tag: "Valid", store, reset, changes }
}

/**
 * Apps' settings: the values their owners and admins chose (the defaults are in the manifests),
 * and their versions, which apps follow to read changes while they run. Who may change them is
 * decided by the caller (`canManageApp`).
 */
export class SettingsStore extends Context.Service<
  SettingsStore,
  {
    view(app: string): Effect.Effect<AppSettings, NotFound>
    /** Applies a change; `changes` is what the app reads differently now (empty when nothing changed). */
    set(
      app: string,
      by: PrincipalUser,
      change: AppSettingsChange,
    ): Effect.Effect<
      { readonly settings: AppSettings; readonly changes: ReadonlyArray<SettingChange> },
      NotFound | BadRequest
    >
    /** The app's values once newer than `after`, waiting up to `wait` for a change. */
    snapshot(app: string, after: number | undefined, wait: Duration.Duration): Effect.Effect<AppSettingsSnapshot>
  }
>()("@mosaik/platform-service/SettingsStore") {
  static readonly layer = Layer.effect(
    SettingsStore,
    Effect.gen(function* () {
      const sql = yield* PgClient.PgClient
      const apps = yield* Apps
      const changed = yield* PubSub.sliding<string>(64)

      yield* Effect.gen(function* () {
        const notifications = yield* sql.listen(CHANNEL)
        while (true) yield* PubSub.publish(changed, (yield* Queue.take(notifications)).payload)
      }).pipe(
        Effect.scoped,
        Effect.tapCause((cause) => Effect.logWarning("Settings listener stopped, reconnecting", cause)),
        Effect.retry(Schedule.spaced("5 seconds")),
        Effect.forkScoped,
      )

      const findStored = SqlSchema.findAll({
        Request: Schema.String,
        Result: StoredRow,
        execute: (app) => sql`SELECT name, value, changed_by, changed_at FROM app_settings WHERE app_id = ${app}`,
      })
      const stored = (app: string) => findStored(app).pipe(Effect.orDie)

      /** The app's declarations, from the manifest it registered (none before it registers). */
      const declarations = Effect.fn(function* (app: string) {
        const record = yield* apps.get(app)
        if (Option.isNone(record)) return yield* new NotFound({ resource: "app", id: app })
        return record.value.manifest?.settings ?? []
      })

      const version = (app: string) =>
        sql<{ version: string }>`SELECT settings_version AS version FROM apps WHERE id = ${app}`.pipe(
          Effect.map((rows) => Number(rows[0]?.version ?? 0)),
          Effect.orDie,
        )

      const snapshotNow = Effect.fn(function* (app: string) {
        const rows = yield* stored(app)
        return new AppSettingsSnapshot({
          version: yield* version(app),
          values: Object.fromEntries(rows.map((row) => [row.name, row.value])),
        })
      })

      return SettingsStore.of({
        view: Effect.fn("Settings.view")(function* (app: string) {
          return settingsView(app, yield* declarations(app), yield* stored(app))
        }),

        set: Effect.fn("Settings.set")(function* (app: string, by: PrincipalUser, change: AppSettingsChange) {
          const declared = yield* declarations(app)
          const plan = planChange(declared, yield* stored(app), change)
          if (plan._tag === "Invalid") return yield* new BadRequest({ message: plan.problems.join("; ") })
          if (plan.store.length > 0 || plan.reset.length > 0) {
            yield* sql
              .withTransaction(
                Effect.gen(function* () {
                  for (const { name, value } of plan.store) {
                    yield* sql`
                      INSERT INTO app_settings (app_id, name, value, changed_by)
                      VALUES (${app}, ${name}, ${sql.json(value)}, ${by.name})
                      ON CONFLICT (app_id, name) DO UPDATE SET
                        value = EXCLUDED.value, changed_by = EXCLUDED.changed_by, changed_at = now()
                    `
                  }
                  if (plan.reset.length > 0) {
                    yield* sql`DELETE FROM app_settings WHERE app_id = ${app} AND name IN ${sql.in(plan.reset)}`
                  }
                  yield* sql`UPDATE apps SET settings_version = settings_version + 1 WHERE id = ${app}`
                  // Delivered on commit: the app reads the new values, never half of them.
                  yield* sql`SELECT pg_notify(${CHANNEL}, ${app})`
                }),
              )
              .pipe(Effect.orDie)
          }
          return { settings: settingsView(app, declared, yield* stored(app)), changes: plan.changes }
        }),

        snapshot: Effect.fn("Settings.snapshot")(function* (app, after, wait) {
          return yield* Effect.scoped(
            Effect.gen(function* () {
              // Subscribe before reading, so a change made in between still wakes us.
              const subscription = yield* PubSub.subscribe(changed)
              const first = yield* snapshotNow(app)
              if (after === undefined || first.version > after || Duration.isZero(wait)) return first
              const woken = yield* Effect.gen(function* () {
                while ((yield* PubSub.take(subscription)) !== app) {}
              }).pipe(Effect.timeoutOption(Duration.min(wait, Duration.seconds(MAX_EVENTS_WAIT_SECONDS))))
              return Option.isSome(woken) ? yield* snapshotNow(app) : first
            }),
          )
        }),
      })
    }),
  )
}
