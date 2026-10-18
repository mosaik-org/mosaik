import { PgClient } from "@effect/sql-pg"
import { Config, Effect, Layer, type Redacted } from "effect"
import { camelToSnake, snakeToCamel } from "effect/String"
import { Migrator, type SqlClient } from "effect/sql"
import { serviceDatabaseUrl } from "./Provision"

export type Migrations = Record<string, Effect.Effect<void, unknown, SqlClient.SqlClient>>

export interface DatabaseOptions {
  /** The service (app id, or `auth`) owning the database `mosaik_<serviceId>`. */
  readonly serviceId: string
  /**
   * Migrations keyed by `<id>_<name>` (e.g. `0001_create_orders`). They run once,
   * in id order, when the service starts; concurrent starts are serialized by a table lock.
   */
  readonly migrations?: Migrations
}

const MIGRATIONS_TABLE = "mosaik_migrations"

/**
 * Connection URL: `DATABASE_URL` when set (e.g. an external database), otherwise the
 * provisioned database on `DB_SERVER_URL`, with the password derived from `DB_PASSWORD_SECRET`.
 */
export const url = (serviceId: string): Config.Config<Redacted.Redacted<string>> =>
  Config.Redacted("DATABASE_URL").pipe(
    Config.orElse(() =>
      Config.all({ server: Config.String("DB_SERVER_URL"), secret: Config.Redacted("DB_PASSWORD_SECRET") }).pipe(
        Config.map(({ server, secret }) => serviceDatabaseUrl(server, secret, serviceId)),
      ),
    ),
  )

/**
 * Postgres client + migrations. Provides `SqlClient` (from `effect/sql`) and `PgClient`.
 *
 * Column naming convention: write snake_case in SQL; result rows are camelCase and
 * helpers like `sql.insert({ createdAt })` map back to snake_case.
 */
export const layer = (options: DatabaseOptions) => {
  const client = PgClient.layerConfig({
    url: url(options.serviceId),
    applicationName: Config.succeed(`mosaik-${options.serviceId}`),
    transformResultNames: Config.succeed(snakeToCamel),
    transformQueryNames: Config.succeed(camelToSnake),
  })
  if (options.migrations === undefined) return client
  const migrate = Layer.effectDiscard(
    Migrator.make({})({ loader: Migrator.fromRecord(options.migrations), table: MIGRATIONS_TABLE }).pipe(
      Effect.tap((applied) =>
        applied.length > 0
          ? Effect.logInfo(
              "Applied migrations",
              applied.map(([id, name]) => `${id}_${name}`),
            )
          : Effect.void,
      ),
      Effect.withSpan("Database.migrate"),
    ),
  )
  return migrate.pipe(Layer.provideMerge(client))
}
