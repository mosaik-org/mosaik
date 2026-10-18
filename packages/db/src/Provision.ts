import { createHmac } from "node:crypto"
import { Effect, Redacted } from "effect"
import { SqlClient } from "effect/sql"

/**
 * Per-service databases on a shared Postgres server.
 *
 * Every service that needs a database gets its own role and database named
 * `mosaik_<id>`. Passwords are derived from `DB_PASSWORD_SECRET`, so provisioning
 * is idempotent and nothing has to be stored: the dev runner, the compose
 * `provision` job and the services all compute the same connection URL.
 */

const IDENTIFIER = /^[a-z_][a-z0-9_]{0,62}$/

export const databaseName = (serviceId: string): string => {
  const name = `mosaik_${serviceId.replaceAll("-", "_")}`
  if (!IDENTIFIER.test(name)) throw new Error(`Invalid database name "${name}"`)
  return name
}

export const derivePassword = (secret: Redacted.Redacted<string>, name: string): Redacted.Redacted<string> =>
  Redacted.make(createHmac("sha256", Redacted.value(secret)).update(name).digest("base64url"))

/** Connection URL for a service database on the given server (credentials replaced). */
export const serviceDatabaseUrl = (
  serverUrl: string,
  secret: Redacted.Redacted<string>,
  serviceId: string,
): Redacted.Redacted<string> => {
  const name = databaseName(serviceId)
  const url = new URL(serverUrl)
  url.username = name
  url.password = Redacted.value(derivePassword(secret, name))
  url.pathname = `/${name}`
  return Redacted.make(url.toString())
}

/**
 * Creates (or updates the password of) the role and database for a service.
 * Requires a `SqlClient` connected as a superuser (or a role with CREATEROLE + CREATEDB).
 */
export const provisionDatabase = Effect.fn("Database.provision")(function* (
  serviceId: string,
  secret: Redacted.Redacted<string>,
) {
  const sql = yield* SqlClient.SqlClient
  const name = databaseName(serviceId)
  const password = Redacted.value(derivePassword(secret, name))

  const roles = yield* sql`SELECT 1 FROM pg_roles WHERE rolname = ${name}`
  // DDL cannot be parameterized; `name` is validated and the password is base64url.
  yield* sql.unsafe(
    roles.length === 0
      ? `CREATE ROLE "${name}" LOGIN PASSWORD '${password}'`
      : `ALTER ROLE "${name}" WITH LOGIN PASSWORD '${password}'`,
  )

  const databases = yield* sql`SELECT 1 FROM pg_database WHERE datname = ${name}`
  const created = databases.length === 0
  if (created) {
    yield* sql.unsafe(`CREATE DATABASE "${name}" OWNER "${name}"`)
  }
  yield* Effect.logInfo(created ? `Created database ${name}` : `Database ${name} is ready`)
  return { name, created }
})

/** Drops a service's database and role (uninstalling an app with its data). Disconnects open sessions. */
export const dropDatabase = Effect.fn("Database.drop")(function* (serviceId: string) {
  const sql = yield* SqlClient.SqlClient
  const name = databaseName(serviceId)
  // `name` is validated by `databaseName`.
  yield* sql.unsafe(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`)
  yield* sql.unsafe(`DROP ROLE IF EXISTS "${name}"`)
  yield* Effect.logInfo(`Dropped database ${name}`)
})
