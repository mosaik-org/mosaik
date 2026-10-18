import { Unauthorized } from "@mosaik/core"
import {
  AppClient,
  AppDatabase,
  AppRoute,
  PlatformInternalApi,
  RegistryInfo,
  type SourceEvent,
} from "@mosaik/platform/contract"
import { Live } from "@mosaik/server"
import { Duration, Effect, Option, Redacted, Schema } from "effect"
import { HttpMiddleware } from "effect/http"
import { HttpApiBuilder } from "effect/http-api"
import { AccessRequests } from "../AccessRequests"
import { Apps } from "../Apps"
import { Events, serviceConsumer, serviceSubscriber } from "../Events"
import { Provisioner } from "../Provisioner"
import { Registry } from "../Registry"
import { RouteFeed } from "../RouteFeed"

export const RoutesHandlers = HttpApiBuilder.group(
  PlatformInternalApi,
  "routes",
  Effect.fn(function* (handlers) {
    const feed = yield* RouteFeed
    // Within Bun's idle timeout (60 s), and often enough for the gateway to notice a dead connection.
    return handlers.handle("stream", () =>
      Live.eventStream(Schema.Array(AppRoute), feed.changes, { heartbeat: "20 seconds" }),
    )
  }),
)

export const EventsHandlers = HttpApiBuilder.group(
  PlatformInternalApi,
  "events",
  Effect.fn(function* (handlers) {
    const events = yield* Events
    const accessRequests = yield* AccessRequests

    /** Access requests follow users too. Safe to repeat: the sender retries until recorded. */
    const react = (event: SourceEvent) => {
      switch (event.type) {
        case "user.deleted":
          return accessRequests.forgetUser(event.data.userId)
        case "user.access_changed":
          return accessRequests.accessChanged(event.data.userId, event.data.grants)
        case "user.created":
          return Effect.void
      }
    }

    return handlers.handleAll({
      publish: ({ payload }) =>
        events.record(payload.events).pipe(Effect.andThen(Effect.forEach(payload.events, react, { discard: true }))),
      // Services wait here most of the time; keep it out of the request log.
      receive: ({ params, payload }) =>
        HttpMiddleware.withLoggerDisabled(
          events.fetch(serviceSubscriber(params.service, payload.types), Duration.seconds(payload.wait)),
        ),
      acknowledge: ({ params, payload }) =>
        events.acknowledge(serviceConsumer(params.service), payload.position, payload.error?.slice(0, 2000) ?? null),
    })
  }),
)

/** App identities, for the Portal. */
export const RegistryHandlers = HttpApiBuilder.group(
  PlatformInternalApi,
  "registry",
  Effect.fn(function* (handlers) {
    const registry = yield* Registry
    const provisioner = yield* Provisioner
    return handlers.handleAll({
      info: () => Effect.succeed(new RegistryInfo({ databases: provisioner.available })),
      list: () => registry.list,
      get: ({ params }) => registry.get(params.id),
      create: ({ payload }) => registry.create(payload.manifest, payload.upstream),
      update: ({ params, payload }) => registry.update(params.id, payload),
      register: Effect.fn(function* ({ params, payload }) {
        const app = yield* registry.get(params.id)
        yield* registry.applyManifest(params.id, payload, app.publicUrl)
        return yield* registry.get(params.id)
      }),
      rotateKey: ({ params }) => registry.rotateKey(params.id),
      skipEvent: ({ params }) => registry.skipEvent(params.id),
      delete: ({ params }) => registry.remove(params.id),
      provisionDatabase: ({ params }) =>
        provisioner.provision(params.id).pipe(Effect.map((url) => new AppDatabase({ url: Redacted.value(url) }))),
      dropDatabase: ({ params }) => provisioner.drop(params.id),
    })
  }),
)

/** Who an app is, for the auth service signing people in to a standalone app. */
export const ClientsHandlers = HttpApiBuilder.group(
  PlatformInternalApi,
  "clients",
  Effect.fn(function* (handlers) {
    const registry = yield* Registry
    const apps = yield* Apps
    return handlers.handleAll({
      get: ({ params }) =>
        registry.get(params.id).pipe(Effect.map((app) => new AppClient({ id: app.id, publicUrl: app.publicUrl }))),
      authenticate: Effect.fn(function* ({ payload }) {
        const id = yield* apps.authenticate(payload.key)
        if (Option.isNone(id)) return yield* new Unauthorized({ message: "Invalid app key" })
        const app = yield* registry.get(id.value).pipe(Effect.orDie)
        return new AppClient({ id: app.id, publicUrl: app.publicUrl })
      }),
    })
  }),
)
