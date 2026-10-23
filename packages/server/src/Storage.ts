import { BadRequest, NotFound, Unauthorized } from "@mosaik/core"
import {
  APP_KEY_HEADER,
  STORAGE_CONTENT_PATH,
  StorageLimitReached,
  StorageUnavailable,
  StoredObject,
  type StoredObjectsPage,
} from "@mosaik/platform/contract"
import { appKey, PlatformClient } from "@mosaik/platform/server"
import { Config, Context, DateTime, Effect, Layer, Redacted, Schema } from "effect"
import { HttpServerResponse, type Multipart } from "effect/http"

/** What can be stored: bytes, text, a stream, a `Blob`/`File`, or a file uploaded to the app's API. */
export type StorageData = Uint8Array<ArrayBuffer> | string | Blob | ReadableStream<Uint8Array> | Multipart.PersistedFile

/** A stored file, with its content as a stream (read it once). */
export interface StoredFile {
  readonly object: StoredObject
  readonly body: ReadableStream<Uint8Array>
}

export interface RespondOptions {
  /** The name the browser saves it under. Defaults to the key's last segment. */
  readonly filename?: string
  /** Shown in the browser instead of downloaded, for images and PDFs only (see {@link Storage}). */
  readonly inline?: boolean
}

/** Types a browser may show in place: they cannot run scripts in the app's origin. */
const INLINE_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp", "image/avif", "application/pdf"])

const isPersistedFile = (data: StorageData): data is Multipart.PersistedFile =>
  typeof data === "object" && data !== null && "path" in data && "contentType" in data && !(data instanceof Blob)

/** The errors the content routes answer with (as the platform API does). */
const ContentError = Schema.Union([BadRequest, Unauthorized, NotFound, StorageUnavailable, StorageLimitReached])

/** `Content-Disposition` with a name any browser reads, accents included. */
const disposition = (kind: "inline" | "attachment", filename: string) => {
  const ascii = filename.replace(/[^\x20-\x7e]|["\\]/g, "_")
  return `${kind}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`
}

/**
 * A stored file as an HTTP response that cannot run as the app: a download, unless it is an image
 * or a PDF asked for `inline`; never another type than the one stored. What `respond` sends (and
 * the testing kit's storage, so tests see the same headers).
 */
export const fileResponse = (file: StoredFile, options: RespondOptions = {}): HttpServerResponse.HttpServerResponse => {
  const { object, body } = file
  const inline = options.inline === true && INLINE_TYPES.has(object.contentType)
  const filename = options.filename ?? object.key.split("/").at(-1) ?? object.key
  return HttpServerResponse.fromWeb(
    new Response(body, {
      headers: {
        "content-type": object.contentType,
        "content-length": String(object.size),
        "content-disposition": disposition(inline ? "inline" : "attachment", filename),
        "x-content-type-options": "nosniff",
        // No scripts in the app's origin (a PDF viewer cannot run in a sandbox, and has its own).
        ...(object.contentType === "application/pdf" ? {} : { "content-security-policy": "sandbox" }),
        "cache-control": "private, no-cache",
      },
    }),
  )
}

/**
 * The app's files, stored by the platform (declare `storage: true` in the manifest). Keys are the
 * app's own paths (`orders/123/invoice.pdf`); what each one may hold, and who may read it, is the
 * app's to decide: the platform only keeps every app within the limit an admin gave it.
 *
 * Files go through the app: it receives uploads in its own API (a multipart payload, checked as it
 * wants), stores them with {@link Storage.put}, and serves them with {@link Storage.respond}, which
 * sends them so that a file cannot run scripts as the app (a download, unless it is an image or a
 * PDF asked for `inline`). Contents stream both ways.
 *
 * @example
 * const storage = yield* Storage
 * yield* storage.put(`orders/${id}/${file.name}`, file)          // a file from a multipart payload
 * return yield* storage.respond(`orders/${id}/${name}`)          // in a handler: the download
 */
export class Storage extends Context.Service<
  Storage,
  {
    /** Stores `data` at `key`, replacing what is there. `contentType` defaults to the file's, or binary. */
    put(
      key: string,
      data: StorageData,
      options?: { readonly contentType?: string },
    ): Effect.Effect<StoredObject, StorageLimitReached | StorageUnavailable | BadRequest>
    get(key: string): Effect.Effect<StoredFile, NotFound | StorageUnavailable>
    /** Its size, type and date, without the content. */
    head(key: string): Effect.Effect<StoredObject, NotFound | StorageUnavailable>
    /** Nothing happens when there is no file at `key`. */
    delete(key: string): Effect.Effect<void, StorageUnavailable>
    /** Files whose key starts with `prefix`, in key order; pass `next` as `after` for the following page. */
    list(options?: {
      readonly prefix?: string
      readonly after?: string
      readonly limit?: number
    }): Effect.Effect<StoredObjectsPage, StorageUnavailable>
    /** The file as an HTTP response, for a handler to return: a download unless `inline` (images and PDFs). */
    respond(
      key: string,
      options?: RespondOptions,
    ): Effect.Effect<HttpServerResponse.HttpServerResponse, NotFound | StorageUnavailable>
  }
>()("@mosaik/server/Storage") {
  static readonly layer = (appId: string) =>
    Layer.effect(
      Storage,
      Effect.gen(function* () {
        const client = yield* PlatformClient
        const base = yield* Config.URL("PLATFORM_URL")
        const key = Redacted.value(yield* appKey(appId))
        const content = (name: string) => {
          const url = new URL(STORAGE_CONTENT_PATH, base)
          url.searchParams.set("key", name)
          return url
        }
        const unreachable = (cause: unknown) =>
          new StorageUnavailable({ message: `The platform cannot be reached: ${String(cause).slice(0, 200)}` })
        /** The platform's answer to a content request that failed, as the typed API would fail. */
        const failure = Effect.fnUntraced(function* (response: Response) {
          const json = yield* Effect.tryPromise({ try: () => response.json(), catch: unreachable })
          const error = yield* Schema.decodeUnknownEffect(Schema.toCodecJson(ContentError))(json).pipe(
            Effect.mapError(unreachable),
          )
          // The key is the platform's to check: an app it does not know has no storage to use.
          return yield* Effect.fail(
            error._tag === "Unauthorized" ? new StorageUnavailable({ message: error.message }) : error,
          )
        })
        /** The platform's typed API, its transport failures as `StorageUnavailable`. */
        const call = <A, E>(effect: Effect.Effect<A, E>) =>
          effect.pipe(
            Effect.catchIf(
              (error): error is Exclude<E, NotFound | StorageUnavailable> =>
                !(error instanceof NotFound) && !(error instanceof StorageUnavailable),
              (error) => Effect.fail(unreachable(error)),
            ),
          ) as Effect.Effect<A, Extract<E, NotFound | StorageUnavailable> | StorageUnavailable>

        const get = Effect.fn("Storage.get")(function* (name: string) {
          const response = yield* Effect.tryPromise({
            try: () => fetch(content(name), { headers: { [APP_KEY_HEADER]: key } }),
            catch: unreachable,
          })
          if (!response.ok || response.body === null) {
            return yield* failure(response).pipe(
              Effect.catchTag(["BadRequest", "StorageLimitReached"], (error) => Effect.fail(unreachable(error))),
            )
          }
          const lastModified = response.headers.get("last-modified")
          return {
            object: new StoredObject({
              key: name,
              size: Number(response.headers.get("content-length") ?? 0),
              contentType: response.headers.get("content-type") ?? "application/octet-stream",
              updatedAt: lastModified === null ? DateTime.nowUnsafe() : DateTime.makeUnsafe(new Date(lastModified)),
            }),
            body: response.body,
          } satisfies StoredFile
        })

        return Storage.of({
          put: Effect.fn("Storage.put")(function* (name, data, options) {
            const body = isPersistedFile(data) ? Bun.file(data.path).stream() : data
            const contentType =
              options?.contentType ?? (isPersistedFile(data) ? data.contentType : data instanceof Blob ? data.type : "")
            const response = yield* Effect.tryPromise({
              try: () =>
                fetch(content(name), {
                  method: "PUT",
                  body,
                  headers: {
                    [APP_KEY_HEADER]: key,
                    "content-type": contentType === "" ? "application/octet-stream" : contentType,
                  },
                }),
              catch: unreachable,
            })
            if (!response.ok) {
              return yield* failure(response).pipe(
                Effect.catchTag("NotFound", (error) => Effect.fail(unreachable(error))),
              )
            }
            return yield* Effect.tryPromise({ try: () => response.json(), catch: unreachable }).pipe(
              Effect.flatMap(Schema.decodeUnknownEffect(Schema.toCodecJson(StoredObject))),
              Effect.mapError(unreachable),
            )
          }),

          get,

          head: (name) => call(client.app.storedObject({ query: { key: name } })),

          delete: (name) => call(client.app.deleteStoredObject({ query: { key: name } })),

          list: (options = {}) => call(client.app.storedObjects({ query: options })),

          respond: (name, options) => Effect.map(get(name), (file) => fileResponse(file, options)),
        })
      }),
    )
}
