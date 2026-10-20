import { BadRequest, NotFound, Unauthorized } from "@mosaik/core"
import {
  APP_KEY_HEADER,
  STORAGE_CONTENT_PATH,
  StorageLimitReached,
  StorageUnavailable,
  StoredObject,
  storageKeyProblem,
} from "@mosaik/platform/contract"
import { Effect, Option, Schema } from "effect"
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/http"
import { Apps } from "../Apps"
import { AppStorage } from "../Storage"

/** The errors of these routes, as the typed API sends errors: so `Storage` decodes both alike. */
const ContentError = Schema.Union([BadRequest, Unauthorized, NotFound, StorageUnavailable, StorageLimitReached])
type ContentError = typeof ContentError.Type

const STATUS: Record<ContentError["_tag"], number> = {
  BadRequest: 400,
  Unauthorized: 401,
  NotFound: 404,
  StorageUnavailable: 503,
  StorageLimitReached: 507,
}

/** JSON as the typed API writes it (dates as ISO strings). */
const encodeObject = Schema.encodeSync(Schema.toCodecJson(StoredObject))
const encodeError = Schema.encodeSync(Schema.toCodecJson(ContentError))

const failure = (error: ContentError) =>
  Effect.succeed(HttpServerResponse.jsonUnsafe(encodeError(error), { status: STATUS[error._tag] }))

/**
 * The content of apps' files, streamed both ways (`STORAGE_CONTENT_PATH`, `?key=`): `PUT` stores
 * the request body as it arrives (with its `content-type`), `GET` sends it back. Authenticated
 * with the app's key, like the platform API, whose typed endpoints cover the rest (a file's size,
 * listing, removing).
 */
export const StorageContentRoutes = HttpRouter.use(
  Effect.fn(function* (router) {
    const apps = yield* Apps
    const storage = yield* AppStorage

    /** The calling app and the key the request names. */
    const target = Effect.fn(function* (request: HttpServerRequest.HttpServerRequest) {
      const key = request.headers[APP_KEY_HEADER]
      const app = key === undefined ? Option.none<string>() : yield* apps.authenticate(key)
      if (Option.isNone(app)) return yield* new Unauthorized({ message: "Invalid app key" })
      const name = new URL(request.url, "http://platform").searchParams.get("key") ?? ""
      const problem = storageKeyProblem(name)
      if (problem !== undefined) return yield* new BadRequest({ message: `Invalid key: ${problem}` })
      yield* Effect.annotateCurrentSpan({ "mosaik.app": app.value, "mosaik.storage.key": name })
      return { app: app.value, key: name }
    })

    yield* router.add(
      "PUT",
      STORAGE_CONTENT_PATH,
      Effect.fn("Storage.putContent")(function* (request: HttpServerRequest.HttpServerRequest) {
        const { app, key } = yield* target(request)
        const body = (yield* HttpServerRequest.toWeb(request).pipe(Effect.orDie)).body
        if (body === null) return yield* new BadRequest({ message: "No content" })
        const contentType = request.headers["content-type"] ?? "application/octet-stream"
        const stored = yield* storage.put(app, key, body, contentType)
        return HttpServerResponse.jsonUnsafe(encodeObject(stored))
      }, Effect.catch(failure)),
    )

    yield* router.add(
      "GET",
      STORAGE_CONTENT_PATH,
      Effect.fn("Storage.getContent")(function* (request: HttpServerRequest.HttpServerRequest) {
        const { app, key } = yield* target(request)
        const { object, body } = yield* storage.read(app, key)
        return HttpServerResponse.fromWeb(
          new Response(body, {
            headers: {
              "content-type": object.contentType,
              "content-length": String(object.size),
              "last-modified": new Date(object.updatedAt.epochMilliseconds).toUTCString(),
            },
          }),
        )
      }, Effect.catch(failure)),
    )
  }),
)
