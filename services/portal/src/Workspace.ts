import { PgClient } from "@effect/sql-pg"
import type { UserId } from "@mosaik/core"
import { ACTIVE_DAYS, AppPopularity, AppUsage, AppUsageStats, MyApps } from "@mosaik/portal/contract"
import { Context, Effect, Layer, Schema } from "effect"
import { SqlSchema } from "effect/sql"

const UsageRow = Schema.Struct({
  app: Schema.String,
  opens: Schema.Number,
  lastOpenedAt: Schema.DateTimeUtcFromDate,
})

const StatsRow = Schema.Struct({
  app: Schema.String,
  activeUsers: Schema.Number,
  users: Schema.Number,
  opens: Schema.Number,
  lastOpenedAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
})

/**
 * How people find their way among many apps: the apps each user pinned, how often and
 * how recently each user opens each app, and the categories admins chose for apps.
 */
export class Workspace extends Context.Service<
  Workspace,
  {
    apps(user: UserId): Effect.Effect<MyApps>
    setPinned(user: UserId, apps: ReadonlyArray<string>): Effect.Effect<MyApps>
    opened(user: UserId, app: string): Effect.Effect<void>
    readonly popularity: Effect.Effect<ReadonlyArray<AppPopularity>>
    readonly usage: Effect.Effect<ReadonlyArray<AppUsageStats>>
    /** Categories admins chose, by app id. */
    readonly categories: Effect.Effect<Readonly<Record<string, string>>>
    setCategory(app: string, category: string | null): Effect.Effect<void>
    forgetUser(user: UserId): Effect.Effect<void>
    forgetApp(app: string): Effect.Effect<void>
  }
>()("@mosaik/portal-service/Workspace") {
  static readonly layer = Layer.effect(
    Workspace,
    Effect.gen(function* () {
      const sql = yield* PgClient.PgClient
      const active = sql.literal(`now() - interval '${ACTIVE_DAYS} days'`)

      const findPinned = SqlSchema.findOneOption({
        Request: Schema.String,
        Result: Schema.Struct({ pinnedApps: Schema.Array(Schema.String) }),
        execute: (user) => sql`SELECT pinned_apps FROM user_preferences WHERE user_id = ${user}`,
      })
      const findUsage = SqlSchema.findAll({
        Request: Schema.String,
        Result: UsageRow,
        execute: (user) => sql`
          SELECT app_id AS app, opens, last_opened_at FROM app_usage
          WHERE user_id = ${user}
          ORDER BY last_opened_at DESC
        `,
      })
      const findPopularity = SqlSchema.findAll({
        Request: Schema.Void,
        Result: AppPopularity,
        execute: () => sql`
          SELECT app_id AS app, count(*)::int AS active_users FROM app_usage
          WHERE last_opened_at > ${active}
          GROUP BY app_id
        `,
      })
      const findStats = SqlSchema.findAll({
        Request: Schema.Void,
        Result: StatsRow,
        execute: () => sql`
          SELECT app_id AS app,
            (count(*) FILTER (WHERE last_opened_at > ${active}))::int AS active_users,
            count(*)::int AS users,
            sum(opens)::int AS opens,
            max(last_opened_at) AS last_opened_at
          FROM app_usage
          GROUP BY app_id
          ORDER BY active_users DESC, app_id
        `,
      })
      const findCategories = SqlSchema.findAll({
        Request: Schema.Void,
        Result: Schema.Struct({ appId: Schema.String, category: Schema.String }),
        execute: () => sql`SELECT app_id, category FROM app_categories`,
      })

      const apps = Effect.fn("Workspace.apps")(function* (user: UserId) {
        const [pinned, usage] = yield* Effect.all([findPinned(user), findUsage(user)], { concurrency: 2 }).pipe(
          Effect.orDie,
        )
        return new MyApps({
          pinned: pinned._tag === "Some" ? pinned.value.pinnedApps : [],
          usage: usage.map((row) => new AppUsage(row)),
        })
      })

      return Workspace.of({
        apps,

        setPinned: Effect.fn("Workspace.setPinned")(function* (user: UserId, pinned: ReadonlyArray<string>) {
          const unique = [...new Set(pinned)]
          yield* sql`
            INSERT INTO user_preferences ${sql.insert({ userId: user, pinnedApps: sql.json(unique) })}
            ON CONFLICT (user_id) DO UPDATE SET pinned_apps = excluded.pinned_apps, updated_at = now()
          `.pipe(Effect.orDie)
          return yield* apps(user)
        }),

        opened: (user, app) =>
          sql`
            INSERT INTO app_usage ${sql.insert({ userId: user, appId: app })}
            ON CONFLICT (user_id, app_id) DO UPDATE SET opens = app_usage.opens + 1, last_opened_at = now()
          `.pipe(Effect.asVoid, Effect.orDie, Effect.withSpan("Workspace.opened")),

        popularity: findPopularity().pipe(Effect.orDie, Effect.withSpan("Workspace.popularity")),

        usage: findStats().pipe(
          Effect.map((rows) => rows.map((row) => new AppUsageStats(row))),
          Effect.orDie,
          Effect.withSpan("Workspace.usage"),
        ),

        categories: findCategories().pipe(
          Effect.map((rows) => Object.fromEntries(rows.map((row) => [row.appId, row.category]))),
          Effect.orDie,
        ),

        setCategory: (app, category) =>
          (category === null
            ? sql`DELETE FROM app_categories WHERE app_id = ${app}`
            : sql`
                INSERT INTO app_categories ${sql.insert({ appId: app, category })}
                ON CONFLICT (app_id) DO UPDATE SET category = excluded.category, updated_at = now()
              `
          ).pipe(Effect.asVoid, Effect.orDie, Effect.withSpan("Workspace.setCategory")),

        forgetUser: (user) =>
          sql
            .withTransaction(
              Effect.gen(function* () {
                yield* sql`DELETE FROM user_preferences WHERE user_id = ${user}`
                yield* sql`DELETE FROM app_usage WHERE user_id = ${user}`
              }),
            )
            .pipe(Effect.orDie, Effect.withSpan("Workspace.forgetUser")),

        forgetApp: (app) =>
          sql
            .withTransaction(
              Effect.gen(function* () {
                // `-` removes a string from a JSON array.
                yield* sql`
                  UPDATE user_preferences SET pinned_apps = pinned_apps - ${app}::text, updated_at = now()
                  WHERE pinned_apps ? ${app}
                `
                yield* sql`DELETE FROM app_usage WHERE app_id = ${app}`
                yield* sql`DELETE FROM app_categories WHERE app_id = ${app}`
              }),
            )
            .pipe(Effect.orDie, Effect.withSpan("Workspace.forgetApp")),
      })
    }),
  )
}
