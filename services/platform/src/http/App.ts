import { AuditEventInput, JWKS_PATH } from "@mosaik/auth/contract"
import { InternalClient } from "@mosaik/auth/server"
import { BadRequest } from "@mosaik/core"
import { MessageRequest, NotificationRequest } from "@mosaik/notifications/contract"
import { CurrentApp, PlatformApi } from "@mosaik/platform/contract"
import { Cache, Config, Duration, Effect, Exit, Option, Schema } from "effect"
import { HttpClient, HttpClientResponse, HttpMiddleware } from "effect/http"
import { HttpApiBuilder } from "effect/http-api"
import { Apps } from "../Apps"
import { NotificationsClient } from "../clients"
import { appSubscriber, Events } from "../Events"
import { Registry } from "../Registry"

/**
 * The platform API apps call. The calling app's identity comes from its key, never
 * from the request: that is what attributes audit entries, messages and notifications.
 */
export const AppHandlers = HttpApiBuilder.group(
  PlatformApi,
  "app",
  Effect.fn(function* (handlers) {
    const registry = yield* Registry
    const auth = yield* InternalClient
    const notifications = yield* NotificationsClient
    const apps = yield* Apps
    const events = yield* Events

    /** The calling app's registered manifest: it decides which events the app gets. */
    const manifest = Effect.fn(function* (id: string) {
      const app = yield* apps.get(id)
      const manifest = Option.flatMapNullishOr(app, (app) => app.manifest)
      if (Option.isNone(manifest)) return yield* new BadRequest({ message: "Register the app before fetching events" })
      if (manifest.value.events.length === 0) {
        return yield* new BadRequest({ message: "The app's manifest subscribes to no events" })
      }
      return manifest.value
    })

    return handlers.handleAll({
      register: Effect.fn("Platform.register")(function* ({ payload: { manifest, publicUrl } }) {
        const app = yield* CurrentApp
        if (manifest.id !== app.id) {
          return yield* new BadRequest({ message: `This key belongs to "${app.id}", not "${manifest.id}"` })
        }
        yield* registry.applyManifest(app.id, manifest, publicUrl)
        yield* Effect.logInfo(`Registered app "${app.id}"`, { version: manifest.version, publicUrl })
      }),

      audit: Effect.fn("Platform.audit")(function* ({ payload }) {
        const app = yield* CurrentApp
        yield* auth.internal
          .recordAudit({ payload: new AuditEventInput({ ...payload, app: app.id }) })
          .pipe(Effect.orDie)
      }),

      messages: Effect.fn("Platform.messages")(function* ({ payload }) {
        const app = yield* CurrentApp
        return yield* notifications.messages.send({ payload: new MessageRequest({ ...payload, source: app.id }) }).pipe(
          Effect.catchIf(
            (error) => error._tag !== "BadRequest" && error._tag !== "RateLimited",
            (error) => Effect.die(error),
          ),
        )
      }),

      notifications: Effect.fn("Platform.notifications")(function* ({ payload }) {
        const app = yield* CurrentApp
        return yield* notifications.notifications
          .send({ payload: new NotificationRequest({ ...payload, source: app.id }) })
          .pipe(
            Effect.catchIf(
              (error) => error._tag !== "BadRequest",
              (error) => Effect.die(error),
            ),
          )
      }),

      // Apps ask every few seconds; keep it out of the request log.
      events: ({ query }) =>
        HttpMiddleware.withLoggerDisabled(
          Effect.gen(function* () {
            const app = yield* CurrentApp
            const wait = Duration.seconds(Math.max(0, query.wait ?? 0))
            return yield* events.fetch(appSubscriber(app.id, yield* manifest(app.id)), wait)
          }).pipe(Effect.withSpan("Platform.events")),
        ),

      ackEvents: Effect.fn("Platform.ackEvents")(function* ({ payload }) {
        const app = yield* CurrentApp
        yield* manifest(app.id)
        yield* events.acknowledge(app.id, payload.position, payload.error?.slice(0, 2000) ?? null)
      }),
    })
  }),
)

/** The auth service's public keys, so apps outside the private network can verify tokens. */
export const KeysHandlers = HttpApiBuilder.group(
  PlatformApi,
  "keys",
  Effect.fn(function* (handlers) {
    const authUrl = yield* Config.URL("AUTH_URL")
    const client = (yield* HttpClient.HttpClient).pipe(HttpClient.filterStatusOk)
    const keys = yield* Cache.makeWith(
      () =>
        client
          .get(new URL(JWKS_PATH, authUrl))
          .pipe(Effect.flatMap(HttpClientResponse.schemaBodyJson(Schema.Unknown)), Effect.timeout(Duration.seconds(5))),
      { capacity: 1, timeToLive: (exit) => (Exit.isSuccess(exit) ? Duration.minutes(5) : Duration.zero) },
    )
    return handlers.handle("jwks", () => Cache.get(keys, "jwks").pipe(Effect.orDie))
  }),
)
