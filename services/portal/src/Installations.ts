import { PgClient } from "@effect/sql-pg"
import { DatabaseMode, RegistryCredential } from "@mosaik/portal/contract"
import { Context, Effect, Layer, Option, Schema } from "effect"
import { SqlSchema } from "effect/sql"

const InstallationRow = Schema.Struct({
  appId: Schema.String,
  source: Schema.Literals(["remote", "image"]),
  url: Schema.NullOr(Schema.String),
  image: Schema.NullOr(Schema.String),
  digest: Schema.NullOr(Schema.String),
  previousImage: Schema.NullOr(Schema.String),
  previousDigest: Schema.NullOr(Schema.String),
  databaseMode: DatabaseMode,
  keySecret: Schema.NullOr(Schema.String),
  deployment: Schema.NullOr(Schema.Literals(["deploying", "failed"])),
  deploymentMessage: Schema.NullOr(Schema.String),
  createdAt: Schema.DateTimeUtcFromDate,
})
export type Installation = typeof InstallationRow.Type

/** Columns an installer may change. */
export interface InstallationChanges {
  readonly url?: string | null
  readonly image?: string | null
  readonly digest?: string | null
  readonly previousImage?: string | null
  readonly previousDigest?: string | null
  readonly databaseMode?: DatabaseMode
  readonly keySecret?: string | null
  readonly deployment?: "deploying" | "failed" | null
  readonly deploymentMessage?: string | null
}

export interface NewInstallation extends InstallationChanges {
  readonly appId: string
  readonly source: "remote" | "image"
}

export interface StoredConfig {
  readonly name: string
  /** Encrypted when `secret`. */
  readonly value: string
  readonly secret: boolean
}

const ConfigRow = Schema.Struct({ name: Schema.String, value: Schema.String, secret: Schema.Boolean })
const RegistryRow = Schema.Struct({
  server: Schema.String,
  username: Schema.String,
  password: Schema.String,
  createdAt: Schema.DateTimeUtcFromDate,
})

/** The apps the Portal installed, their settings, and the registries images come from. */
export class Installations extends Context.Service<
  Installations,
  {
    readonly list: Effect.Effect<ReadonlyArray<Installation>>
    get(appId: string): Effect.Effect<Option.Option<Installation>>
    insert(installation: NewInstallation): Effect.Effect<Installation>
    update(appId: string, changes: InstallationChanges): Effect.Effect<Installation>
    delete(appId: string): Effect.Effect<void>
    config(appId: string): Effect.Effect<ReadonlyArray<StoredConfig>>
    setConfig(appId: string, values: ReadonlyArray<StoredConfig>): Effect.Effect<void>
    readonly registries: Effect.Effect<ReadonlyArray<RegistryCredential>>
    registry(server: string): Effect.Effect<Option.Option<{ readonly username: string; readonly password: string }>>
    setRegistry(server: string, username: string, password: string): Effect.Effect<RegistryCredential>
    deleteRegistry(server: string): Effect.Effect<boolean>
  }
>()("@mosaik/portal-service/Installations") {
  static readonly layer = Layer.effect(
    Installations,
    Effect.gen(function* () {
      const sql = yield* PgClient.PgClient

      const columns = sql.literal(`
        app_id, source, url, image, digest, previous_image, previous_digest, database_mode, key_secret,
        deployment, deployment_message, created_at
      `)
      const findById = SqlSchema.findOneOption({
        Request: Schema.String,
        Result: InstallationRow,
        execute: (id) => sql`SELECT ${columns} FROM installations WHERE app_id = ${id}`,
      })
      const findAll = SqlSchema.findAll({
        Request: Schema.Void,
        Result: InstallationRow,
        execute: () => sql`SELECT ${columns} FROM installations ORDER BY app_id`,
      })
      const findConfig = SqlSchema.findAll({
        Request: Schema.String,
        Result: ConfigRow,
        execute: (id) => sql`SELECT name, value, secret FROM install_config WHERE app_id = ${id} ORDER BY name`,
      })
      const findRegistries = SqlSchema.findAll({
        Request: Schema.Void,
        Result: RegistryRow,
        execute: () => sql`SELECT server, username, password, created_at FROM registries ORDER BY server`,
      })

      const get = (id: string) => findById(id).pipe(Effect.orDie)
      const getOrDie = (id: string) =>
        get(id).pipe(
          Effect.flatMap(
            Option.match({ onNone: () => Effect.die(`Installation "${id}" vanished`), onSome: Effect.succeed }),
          ),
        )
      const defined = (changes: InstallationChanges) =>
        Object.fromEntries(Object.entries(changes).filter(([, value]) => value !== undefined))

      return Installations.of({
        list: findAll().pipe(Effect.orDie),
        get,

        insert: (installation) =>
          sql`INSERT INTO installations ${sql.insert(defined(installation))}`.pipe(
            Effect.orDie,
            Effect.andThen(getOrDie(installation.appId)),
          ),

        update: Effect.fn("Installations.update")(function* (id: string, changes: InstallationChanges) {
          const set = defined(changes)
          if (Object.keys(set).length > 0) {
            yield* sql`UPDATE installations SET ${sql.update({ ...set, updatedAt: new Date() })} WHERE app_id = ${id}`.pipe(
              Effect.orDie,
            )
          }
          return yield* getOrDie(id)
        }),

        delete: (id) => sql`DELETE FROM installations WHERE app_id = ${id}`.pipe(Effect.asVoid, Effect.orDie),

        config: (id) => findConfig(id).pipe(Effect.orDie),

        setConfig: (id, rows) =>
          sql
            .withTransaction(
              Effect.gen(function* () {
                yield* sql`DELETE FROM install_config WHERE app_id = ${id}`
                if (rows.length > 0) {
                  yield* sql`INSERT INTO install_config ${sql.insert(rows.map((row) => ({ appId: id, ...row })))}`
                }
              }),
            )
            .pipe(Effect.orDie),

        registries: findRegistries().pipe(
          Effect.map((rows) => rows.map(({ password: _, ...row }) => new RegistryCredential(row))),
          Effect.orDie,
        ),

        registry: (server) =>
          findRegistries().pipe(
            Effect.map((rows) =>
              Option.fromUndefinedOr(rows.find((row) => row.server === server)).pipe(
                Option.map(({ username, password }) => ({ username, password })),
              ),
            ),
            Effect.orDie,
          ),

        setRegistry: Effect.fn("Installations.setRegistry")(function* (
          server: string,
          username: string,
          password: string,
        ) {
          yield* sql`
            INSERT INTO registries ${sql.insert({ server, username, password })}
            ON CONFLICT (server) DO UPDATE SET username = excluded.username, password = excluded.password
          `.pipe(Effect.orDie)
          const rows = yield* findRegistries().pipe(Effect.orDie)
          const row = rows.find((candidate) => candidate.server === server)
          if (row === undefined) return yield* Effect.die("Registry vanished")
          const { password: _, ...credential } = row
          return new RegistryCredential(credential)
        }),

        deleteRegistry: (server) =>
          sql`DELETE FROM registries WHERE server = ${server} RETURNING server`.pipe(
            Effect.map((rows) => rows.length > 0),
            Effect.orDie,
          ),
      })
    }),
  )
}
