import { PgClient } from "@effect/sql-pg"
import { NotFound } from "@mosaik/core"
import {
  StorageLimitReached,
  StorageUnavailable,
  StorageUsage,
  StoredObject,
  StoredObjectsPage,
} from "@mosaik/platform/contract"
import { Context, Effect, Layer, Option, Redacted, Schema } from "effect"
import { SqlSchema } from "effect/sql"
import { Apps } from "./Apps"
import { PlatformConfig } from "./PlatformConfig"

/** How much more the app may store in a file at `key`: its limit, less what it stores elsewhere. */
export const allowance = (limitBytes: number, usedBytes: number, replacedBytes: number): number =>
  Math.max(0, limitBytes - (usedBytes - replacedBytes))

/** Raised inside a counted stream once it passes its allowance. */
class OverLimit extends Error {}

/**
 * Passes `body` on while counting its bytes, and fails it once it passes `allowance`: the
 * upload stops there, without reading the rest, and nothing is stored (a write fails as a whole).
 */
export const counted = (body: ReadableStream<Uint8Array>, allowance: number) => {
  let bytes = 0
  const stream = body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        bytes += chunk.byteLength
        if (bytes > allowance) controller.error(new OverLimit())
        else controller.enqueue(chunk)
      },
    }),
  )
  return { stream, bytes: () => bytes }
}

/** Queries select `size::float8`: the driver gives `bigint` columns as text or numbers depending on the query. */
const ObjectRow = Schema.Struct({
  key: Schema.String,
  size: Schema.Number,
  contentType: Schema.String,
  updatedAt: Schema.DateTimeUtcFromDate,
})

const toObject = (row: typeof ObjectRow.Type) => new StoredObject(row)

/**
 * Apps' files. Their content is in an S3 service (SeaweedFS), one bucket, a folder per app; here,
 * what the platform needs to know of them: sizes (for each app's limit), types and dates. Only
 * apps that declare `storage` in their manifest store files.
 */
export class AppStorage extends Context.Service<
  AppStorage,
  {
    /** Stores `body` at the app's `key`, replacing what is there; refuses what would take the app over its limit. */
    put(
      app: string,
      key: string,
      body: ReadableStream<Uint8Array>,
      contentType: string,
    ): Effect.Effect<StoredObject, StorageLimitReached | StorageUnavailable>
    read(
      app: string,
      key: string,
    ): Effect.Effect<
      { readonly object: StoredObject; readonly body: ReadableStream<Uint8Array> },
      NotFound | StorageUnavailable
    >
    head(app: string, key: string): Effect.Effect<StoredObject, NotFound | StorageUnavailable>
    remove(app: string, key: string): Effect.Effect<void, StorageUnavailable>
    list(
      app: string,
      options: {
        readonly prefix?: string | undefined
        readonly after?: string | undefined
        readonly limit?: number | undefined
      },
    ): Effect.Effect<StoredObjectsPage, StorageUnavailable>
    usage(app: string): Effect.Effect<StorageUsage, NotFound | StorageUnavailable>
    /** `null`: back to the platform's default. */
    setLimit(app: string, limitBytes: number | null): Effect.Effect<StorageUsage, NotFound | StorageUnavailable>
    /** Removes every file of an app that is going away. */
    removeApp(app: string): Effect.Effect<void>
  }
>()("@mosaik/platform-service/AppStorage") {
  static readonly layer = Layer.effect(
    AppStorage,
    Effect.gen(function* () {
      const sql = yield* PgClient.PgClient
      const apps = yield* Apps
      const config = (yield* PlatformConfig).storage
      const s3 = Option.map(
        config,
        (storage) =>
          new Bun.S3Client({
            endpoint: storage.url,
            bucket: storage.bucket,
            accessKeyId: storage.accessKeyId,
            secretAccessKey: Redacted.value(storage.secretAccessKey),
            region: "us-east-1",
          }),
      )

      const unavailable = (message: string) => new StorageUnavailable({ message })
      /** The S3 client, for an app that declares storage. */
      const storageFor = Effect.fn(function* (app: string) {
        if (Option.isNone(s3) || Option.isNone(config))
          return yield* unavailable("The platform has no storage (STORAGE_URL)")
        const record = yield* apps.get(app)
        if (Option.isNone(record) || record.value.manifest?.storage !== true) {
          return yield* unavailable(`"${app}" does not declare storage in its manifest`)
        }
        return { s3: s3.value, defaultLimitBytes: config.value.defaultLimitBytes }
      })
      const s3Call = <A>(call: () => Promise<A>) =>
        Effect.tryPromise({
          try: call,
          catch: (cause) => unavailable(`The storage service failed: ${String(cause).slice(0, 200)}`),
        })
      const path = (app: string, key: string) => `${app}/${key}`

      const findObject = SqlSchema.findOneOption({
        Request: Schema.Struct({ app: Schema.String, key: Schema.String }),
        Result: ObjectRow,
        execute: ({ app, key }) =>
          sql`SELECT key, size::float8 AS size, content_type, updated_at FROM stored_objects WHERE app_id = ${app} AND key = ${key}`,
      })
      const object = (app: string, key: string) =>
        findObject({ app, key }).pipe(
          Effect.orDie,
          Effect.flatMap(
            Option.match({
              onNone: () => Effect.fail(new NotFound({ resource: "file", id: key })),
              onSome: (row) => Effect.succeed(toObject(row)),
            }),
          ),
        )

      /** What the app stores, and may: its limit, or the default. */
      const accounting = Effect.fn(function* (app: string, defaultLimitBytes: number) {
        const [row] = yield* sql<{ used: string; objects: string; limit: string | null }>`
          SELECT
            (SELECT COALESCE(SUM(size), 0) FROM stored_objects WHERE app_id = ${app}) AS used,
            (SELECT COUNT(*) FROM stored_objects WHERE app_id = ${app}) AS objects,
            storage_limit_bytes AS limit
          FROM apps WHERE id = ${app}
        `.pipe(Effect.orDie)
        if (row === undefined) return yield* new NotFound({ resource: "app", id: app })
        return {
          usedBytes: Number(row.used),
          objects: Number(row.objects),
          limitBytes: row.limit === null ? defaultLimitBytes : Number(row.limit),
          defaultLimit: row.limit === null,
        }
      })

      const usage = Effect.fn("Storage.usage")(function* (app: string) {
        const { defaultLimitBytes } = yield* storageFor(app)
        return new StorageUsage({ app, ...(yield* accounting(app, defaultLimitBytes)) })
      })

      return AppStorage.of({
        put: Effect.fn("Storage.put")(function* (app, key, body, contentType) {
          const { s3, defaultLimitBytes } = yield* storageFor(app)
          const account = yield* accounting(app, defaultLimitBytes).pipe(Effect.orDie)
          const replaced = yield* findObject({ app, key }).pipe(Effect.orDie)
          const upload = counted(
            body,
            allowance(
              account.limitBytes,
              account.usedBytes,
              Option.match(replaced, { onNone: () => 0, onSome: (row) => row.size }),
            ),
          )
          const over = () => new StorageLimitReached({ limitBytes: account.limitBytes, usedBytes: account.usedBytes })
          yield* Effect.tryPromise({
            try: () => s3.write(path(app, key), new Response(upload.stream), { type: contentType }),
            catch: (cause) =>
              cause instanceof OverLimit
                ? over()
                : unavailable(`The storage service failed: ${String(cause).slice(0, 200)}`),
          })
          const [row] = yield* sql<typeof ObjectRow.Encoded>`
            INSERT INTO stored_objects (app_id, key, size, content_type)
            VALUES (${app}, ${key}, ${upload.bytes()}, ${contentType})
            ON CONFLICT (app_id, key) DO UPDATE SET
              size = EXCLUDED.size, content_type = EXCLUDED.content_type, updated_at = now()
            RETURNING key, size::float8 AS size, content_type, updated_at
          `.pipe(Effect.orDie)
          return toObject(Schema.decodeUnknownSync(ObjectRow)(row))
        }),

        read: Effect.fn("Storage.read")(function* (app, key) {
          const { s3 } = yield* storageFor(app)
          const found = yield* object(app, key)
          return { object: found, body: s3.file(path(app, key)).stream() }
        }),

        head: Effect.fn("Storage.head")(function* (app, key) {
          yield* storageFor(app)
          return yield* object(app, key)
        }),

        remove: Effect.fn("Storage.remove")(function* (app, key) {
          const { s3 } = yield* storageFor(app)
          yield* s3Call(() => s3.delete(path(app, key)))
          yield* sql`DELETE FROM stored_objects WHERE app_id = ${app} AND key = ${key}`.pipe(Effect.orDie)
        }),

        list: Effect.fn("Storage.list")(function* (app, options) {
          yield* storageFor(app)
          const limit = options.limit ?? 100
          const rows = yield* sql<typeof ObjectRow.Encoded>`
            SELECT key, size::float8 AS size, content_type, updated_at FROM stored_objects
            WHERE app_id = ${app}
              AND starts_with(key, ${options.prefix ?? ""})
              AND key > ${options.after ?? ""}
            ORDER BY key COLLATE "C"
            LIMIT ${limit + 1}
          `.pipe(Effect.orDie)
          const objects = rows.slice(0, limit).map((row) => toObject(Schema.decodeUnknownSync(ObjectRow)(row)))
          return new StoredObjectsPage({ objects, next: rows.length > limit ? (objects.at(-1)?.key ?? null) : null })
        }),

        usage,

        setLimit: Effect.fn("Storage.setLimit")(function* (app, limitBytes) {
          yield* storageFor(app)
          yield* sql`UPDATE apps SET storage_limit_bytes = ${limitBytes} WHERE id = ${app}`.pipe(Effect.orDie)
          return yield* usage(app)
        }),

        removeApp: Effect.fn("Storage.removeApp")(function* (app) {
          if (Option.isNone(s3)) return
          const client = s3.value
          // From the storage service itself, so files whose row went missing go too.
          let token: string | undefined
          do {
            const page = yield* s3Call(() =>
              client.list({ prefix: `${app}/`, ...(token === undefined ? {} : { continuationToken: token }) }),
            ).pipe(Effect.orDie)
            for (const entry of page.contents ?? []) yield* s3Call(() => client.delete(entry.key)).pipe(Effect.orDie)
            token = page.isTruncated ? page.nextContinuationToken : undefined
          } while (token !== undefined)
          yield* sql`DELETE FROM stored_objects WHERE app_id = ${app}`.pipe(Effect.orDie)
        }),
      })
    }),
  )
}
