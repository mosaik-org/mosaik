import { PgClient } from "@effect/sql-pg"
import { Conflict } from "@mosaik/core"
import { AppManifest, AppOrigin, AppRoute, AppStatus } from "@mosaik/platform/contract"
import { derivedAppKey, generateAppKey, hashAppKey, parseAppKey, sameSecret } from "@mosaik/platform/server"
import { Context, Effect, Layer, Option, Redacted, Schema } from "effect"
import { SqlSchema } from "effect/sql"
import { PlatformConfig } from "./PlatformConfig"

const AppRow = Schema.Struct({
  id: Schema.String,
  origin: AppOrigin,
  status: AppStatus,
  upstream: Schema.NullOr(Schema.String),
  publicUrl: Schema.NullOr(Schema.String),
  keyHash: Schema.NullOr(Schema.String),
  manifest: Schema.NullOr(AppManifest),
  registeredAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
  createdAt: Schema.DateTimeUtcFromDate,
})
export type AppRecord = typeof AppRow.Type

const encodeManifest = Schema.encodeSync(AppManifest)

/**
 * App identities: who each app is (its key), where the gateway reaches it, and the manifest
 * it registered. Configured apps follow `CONFIGURED_APPS` on every start; managed ones are
 * created through the registry API. The gateway routes an app while it is not disabled and
 * has an address.
 */
export class Apps extends Context.Service<
  Apps,
  {
    /** The app a key belongs to, if the key is valid and the app not disabled. */
    authenticate(key: string): Effect.Effect<Option.Option<string>>
    /** Stores what an app registered; a `pending` app becomes `active`. */
    register(id: string, manifest: AppManifest, publicUrl: string | null): Effect.Effect<void>
    readonly routes: Effect.Effect<ReadonlyArray<AppRoute>>
    readonly list: Effect.Effect<ReadonlyArray<AppRecord>>
    get(id: string): Effect.Effect<Option.Option<AppRecord>>
    /** Creates a managed app; returns its key, which only its hash is kept of. */
    create(
      id: string,
      manifest: AppManifest,
      upstream: string | null,
    ): Effect.Effect<{ readonly app: AppRecord; readonly key: Redacted.Redacted<string> }, Conflict>
    setUpstream(id: string, upstream: string | null): Effect.Effect<void>
    setEnabled(id: string, enabled: boolean): Effect.Effect<void>
    /** Issues a managed app a new key; the old one stops working. */
    rotateKey(id: string): Effect.Effect<Redacted.Redacted<string>>
    delete(id: string): Effect.Effect<void>
  }
>()("@mosaik/platform-service/Apps") {
  static readonly layer = Layer.effect(
    Apps,
    Effect.gen(function* () {
      const sql = yield* PgClient.PgClient
      const config = yield* PlatformConfig

      const columns = sql.literal(
        "id, origin, status, upstream, public_url, key_hash, manifest, registered_at, created_at",
      )
      const findById = SqlSchema.findOneOption({
        Request: Schema.String,
        Result: AppRow,
        execute: (id) => sql`SELECT ${columns} FROM apps WHERE id = ${id}`,
      })
      const findAll = SqlSchema.findAll({
        Request: Schema.Void,
        Result: AppRow,
        execute: () => sql`SELECT ${columns} FROM apps ORDER BY id`,
      })
      const findRoutes = SqlSchema.findAll({
        Request: Schema.Void,
        Result: AppRoute,
        execute: () => sql`
          SELECT id, upstream FROM apps
          WHERE upstream IS NOT NULL AND status <> 'disabled'
          ORDER BY id
        `,
      })

      const get = (id: string) => findById(id).pipe(Effect.orDie)
      const getOrDie = (id: string) =>
        get(id).pipe(
          Effect.flatMap(Option.match({ onNone: () => Effect.die(`App "${id}" vanished`), onSome: Effect.succeed })),
        )

      // Configured apps follow the configuration: add or update them, drop the ones removed from it.
      for (const app of config.configuredApps) {
        const existing = yield* get(app.id)
        if (Option.isSome(existing) && existing.value.origin !== "configured") {
          yield* Effect.logError(`Configured app "${app.id}" clashes with a managed app; skipped`)
          continue
        }
        yield* sql`
          INSERT INTO apps ${sql.insert({ id: app.id, origin: "configured", upstream: app.url })}
          ON CONFLICT (id) DO UPDATE SET upstream = excluded.upstream, updated_at = now()
        `.pipe(Effect.orDie)
      }
      const configured = config.configuredApps.map((app) => app.id)
      yield* sql`
        DELETE FROM apps WHERE origin = 'configured'
          AND ${configured.length > 0 ? sql`id NOT IN ${sql.in(configured)}` : sql.literal("true")}
      `.pipe(Effect.orDie)
      yield* Effect.logInfo("Configured apps", { apps: configured })

      return Apps.of({
        authenticate: Effect.fn("Apps.authenticate")(function* (key: string) {
          const parsed = parseAppKey(key)
          if (parsed === undefined) return Option.none()
          const row = yield* get(parsed.appId)
          if (Option.isNone(row) || row.value.status === "disabled") return Option.none()
          const app = row.value
          const valid =
            app.origin === "configured"
              ? sameSecret(key, Redacted.value(derivedAppKey(config.internalKey, app.id)))
              : app.keyHash !== null && sameSecret(hashAppKey(key), app.keyHash)
          return valid ? Option.some(app.id) : Option.none()
        }),

        register: (id, manifest, publicUrl) =>
          sql`
            UPDATE apps SET manifest = ${sql.json(encodeManifest(manifest))}, public_url = ${publicUrl},
              registered_at = now(), updated_at = now(),
              status = CASE WHEN status = 'pending' THEN 'active' ELSE status END
            WHERE id = ${id}
          `.pipe(Effect.asVoid, Effect.orDie),

        routes: findRoutes().pipe(Effect.orDie),
        list: findAll().pipe(Effect.orDie),
        get,

        create: Effect.fn("Apps.create")(function* (id: string, manifest: AppManifest, upstream: string | null) {
          const { key, hash } = generateAppKey(id)
          const rows = yield* sql`
            INSERT INTO apps ${sql.insert({
              id,
              origin: "managed",
              upstream,
              keyHash: hash,
              manifest: sql.json(encodeManifest(manifest)),
            })}
            ON CONFLICT (id) DO NOTHING
            RETURNING id
          `.pipe(Effect.orDie)
          if (rows.length === 0) return yield* new Conflict({ message: `An app with id "${id}" already exists` })
          return { app: yield* getOrDie(id), key }
        }),

        setUpstream: (id, upstream) =>
          sql`UPDATE apps SET upstream = ${upstream}, updated_at = now() WHERE id = ${id}`.pipe(
            Effect.asVoid,
            Effect.orDie,
          ),

        setEnabled: (id, enabled) =>
          sql`
            UPDATE apps SET updated_at = now(), status = CASE
              WHEN NOT ${enabled} THEN 'disabled'
              WHEN status <> 'disabled' THEN status
              WHEN registered_at IS NULL THEN 'pending'
              ELSE 'active'
            END
            WHERE id = ${id}
          `.pipe(Effect.asVoid, Effect.orDie),

        rotateKey: Effect.fn("Apps.rotateKey")(function* (id: string) {
          const { key, hash } = generateAppKey(id)
          yield* sql`UPDATE apps SET key_hash = ${hash}, updated_at = now() WHERE id = ${id}`.pipe(Effect.orDie)
          return key
        }),

        delete: (id) => sql`DELETE FROM apps WHERE id = ${id}`.pipe(Effect.asVoid, Effect.orDie),
      })
    }),
  )
}
