import { InternalClient } from "@mosaik/auth/server"
import { BadRequest, type Conflict, isReservedId, ManifestPayload, NotFound } from "@mosaik/core"
import { NotificationTypesPayload } from "@mosaik/notifications/contract"
import { AppKey, type AppManifest, CreatedApp, PLATFORM_MAJOR, RegistryApp } from "@mosaik/platform/contract"
import { Context, Effect, Layer, Option, Redacted } from "effect"
import { AccessRequests } from "./AccessRequests"
import { type AppRecord, Apps } from "./Apps"
import { NotificationsClient } from "./clients"
import { appSubscriber, Events, type Subscriber } from "./Events"
import { AppStorage } from "./Storage"

const subscriber = (app: AppRecord): Option.Option<Subscriber> =>
  app.manifest === null ? Option.none() : Option.some(appSubscriber(app.id, app.manifest))

/** Why Core refuses a manifest for the app `id`, if it does. */
export const manifestProblem = (id: string, manifest: AppManifest): string | undefined => {
  if (manifest.id !== id) return `This is app "${id}", not "${manifest.id}"`
  if (manifest.platform !== PLATFORM_MAJOR) {
    return `Built for platform ${manifest.platform}, this is platform ${PLATFORM_MAJOR}: rebuild the app`
  }
  if (isReservedId(manifest.id)) return `"${manifest.id}" is reserved by the platform`
  return undefined
}

/**
 * The app registry: identities, the manifests apps register, and everything Core keeps per
 * app (permissions and roles in auth, notification types, access requests, event delivery).
 */
export class Registry extends Context.Service<
  Registry,
  {
    readonly list: Effect.Effect<ReadonlyArray<RegistryApp>>
    get(id: string): Effect.Effect<RegistryApp, NotFound>
    /** Registers the manifest's permissions, roles and notification types, and stores it. */
    applyManifest(id: string, manifest: AppManifest, publicUrl: string | null): Effect.Effect<void, BadRequest>
    create(manifest: AppManifest, upstream: string | null): Effect.Effect<CreatedApp, BadRequest | Conflict>
    update(
      id: string,
      changes: { readonly upstream?: string | null | undefined; readonly enabled?: boolean | undefined },
    ): Effect.Effect<RegistryApp, NotFound>
    rotateKey(id: string): Effect.Effect<AppKey, NotFound | BadRequest>
    skipEvent(id: string): Effect.Effect<RegistryApp, NotFound>
    /** Removes a managed app and what Core keeps for it; its database stays. */
    remove(id: string): Effect.Effect<void, NotFound | BadRequest>
  }
>()("@mosaik/platform-service/Registry") {
  static readonly layer = Layer.effect(
    Registry,
    Effect.gen(function* () {
      const apps = yield* Apps
      const events = yield* Events
      const storage = yield* AppStorage
      const auth = yield* InternalClient
      const notifications = yield* NotificationsClient
      const accessRequests = yield* AccessRequests

      const find = (id: string) =>
        apps.get(id).pipe(
          Effect.flatMap(
            Option.match({
              onNone: () => Effect.fail(new NotFound({ resource: "app", id })),
              onSome: Effect.succeed,
            }),
          ),
        )

      const managed = (app: AppRecord) =>
        app.origin === "managed"
          ? Effect.succeed(app)
          : Effect.fail(new BadRequest({ message: `"${app.id}" follows the configuration (CONFIGURED_APPS)` }))

      const views = Effect.fn("Registry.views")(function* (records: ReadonlyArray<AppRecord>) {
        const status = yield* events.status(records.flatMap((app) => Option.toArray(subscriber(app))))
        return records.map(({ keyHash: _, ...app }) => new RegistryApp({ ...app, events: status.get(app.id) ?? null }))
      })
      const view = (app: AppRecord) => Effect.map(views([app]), ([viewed]) => viewed as RegistryApp)
      const get = (id: string) => Effect.flatMap(find(id), view)

      return Registry.of({
        list: Effect.flatMap(apps.list, views),
        get,

        applyManifest: Effect.fn("Registry.applyManifest")(function* (
          id: string,
          manifest: AppManifest,
          publicUrl: string | null,
        ) {
          const problem = manifestProblem(id, manifest)
          if (problem !== undefined) return yield* new BadRequest({ message: problem })
          yield* auth.internal
            .registerApp({
              payload: new ManifestPayload({
                id: manifest.id,
                name: manifest.name,
                description: manifest.description,
                access: manifest.access,
                permissions: manifest.permissions,
                roles: manifest.roles,
              }),
            })
            .pipe(Effect.orDie)
          yield* notifications.notifications
            .registerTypes({ payload: new NotificationTypesPayload({ source: id, types: manifest.notifications }) })
            .pipe(Effect.catchIf((error) => error._tag !== "BadRequest", Effect.die))
          yield* apps.register(id, manifest, publicUrl)
          yield* events.follow(appSubscriber(id, manifest))
        }),

        create: Effect.fn("Registry.create")(function* (manifest: AppManifest, upstream: string | null) {
          const problem = manifestProblem(manifest.id, manifest)
          if (problem !== undefined) return yield* new BadRequest({ message: problem })
          const { app, key } = yield* apps.create(manifest.id, manifest, upstream)
          // Events from now on wait for the app, even before it first registers.
          yield* events.follow(appSubscriber(app.id, manifest))
          yield* Effect.logInfo(`Created app "${app.id}"`)
          return new CreatedApp({ app: yield* view(app), key: Redacted.value(key) })
        }),

        update: Effect.fn("Registry.update")(function* (id, changes) {
          yield* find(id)
          if (changes.upstream !== undefined) yield* apps.setUpstream(id, changes.upstream)
          if (changes.enabled !== undefined) yield* apps.setEnabled(id, changes.enabled)
          return yield* get(id)
        }),

        rotateKey: Effect.fn("Registry.rotateKey")(function* (id: string) {
          yield* find(id).pipe(Effect.flatMap(managed))
          return new AppKey({ key: Redacted.value(yield* apps.rotateKey(id)) })
        }),

        skipEvent: Effect.fn("Registry.skipEvent")(function* (id: string) {
          const app = yield* find(id)
          yield* Option.match(subscriber(app), { onNone: () => Effect.void, onSome: events.skip })
          return yield* get(id)
        }),

        remove: Effect.fn("Registry.remove")(function* (id: string) {
          yield* find(id).pipe(Effect.flatMap(managed))
          yield* auth.internal.unregisterApp({ params: { id } }).pipe(Effect.orDie)
          yield* notifications.notifications
            .registerTypes({ payload: new NotificationTypesPayload({ source: id, types: [] }) })
            .pipe(Effect.orDie)
          yield* accessRequests.forgetApp(id)
          yield* events.forget(id)
          yield* storage.removeApp(id)
          yield* apps.delete(id)
          yield* Effect.logInfo(`Removed app "${id}"`)
        }),
      })
    }),
  )
}
