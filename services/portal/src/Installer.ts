import { BadRequest, Conflict, isReservedId, type NotFound } from "@mosaik/core"
import {
  AppKey,
  AppManifest,
  type ConfigSetting,
  MANIFEST_PATH,
  PLATFORM_MAJOR,
  type RegistryApp,
} from "@mosaik/platform/contract"
import {
  AdminApp,
  AppLogs,
  type AppSource,
  ConfigValue,
  Inspection,
  Installed,
  type InstallRequest,
  PublicApp,
  portalApp,
  RESERVED_ENV,
} from "@mosaik/portal/contract"
import { Context, Deferred, Duration, Effect, FiberMap, Layer, Option, Schedule, Schema } from "effect"
import { CoreClient, fromCore } from "./clients"
import { Deployer, type PulledImage } from "./Deployer"
import { Health } from "./Health"
import { type Installation, Installations, type StoredConfig } from "./Installations"
import { PortalConfig } from "./PortalConfig"
import { Secrets } from "./Secrets"
import { Workspace } from "./Workspace"

const CONFIG_NAME = /^[A-Z][A-Z0-9_]*$/
/** How long an inspect request waits for a pull before answering "pulling". */
const INSPECT_WAIT = Duration.seconds(20)
/** Pulled images stay inspected this long, so installing does not pull again. */
const INSPECTION_TTL = Duration.minutes(15)
const RECONCILE_EVERY = Duration.seconds(15)

const decodeManifest = Schema.decodeUnknownEffect(AppManifest)

type InspectResult =
  | { readonly ok: true; readonly pulled: PulledImage }
  | { readonly ok: false; readonly error: string }

/** Problems that prevent installing (or upgrading to) an app with this manifest. */
export const manifestProblems = (manifest: AppManifest): ReadonlyArray<string> => [
  ...(manifest.platform !== PLATFORM_MAJOR
    ? [`Built for platform ${manifest.platform}; this is platform ${PLATFORM_MAJOR}. Rebuild the app.`]
    : []),
  ...(isReservedId(manifest.id) || manifest.id === portalApp.id
    ? [`"${manifest.id}" is reserved by the platform`]
    : []),
  ...manifest.portal.config
    .filter((setting) => RESERVED_ENV.has(setting.name))
    .map((setting) => `Config "${setting.name}" is set by the Portal and cannot be declared`),
]

const trimSlash = (url: string) => url.replace(/\/+$/, "")

/**
 * Installs and runs apps: remote apps (hosted elsewhere, by URL) and image apps (Docker
 * images the Portal runs). Core holds each app's identity: the Portal creates it, tells
 * Core where the app runs, and removes it on uninstall. Deployments run in the background,
 * one at a time per app; a failed upgrade rolls back to the previous image.
 */
export class Installer extends Context.Service<
  Installer,
  {
    /** Every app Core knows, with what the Portal knows of it. */
    readonly list: Effect.Effect<ReadonlyArray<AdminApp>>
    /** Apps the shell loads at runtime. */
    readonly catalog: Effect.Effect<ReadonlyArray<PublicApp>>
    inspect(source: AppSource): Effect.Effect<Inspection, BadRequest>
    install(request: InstallRequest): Effect.Effect<Installed, BadRequest | Conflict>
    upgrade(id: string, image: string): Effect.Effect<AdminApp, NotFound | BadRequest | Conflict>
    rollback(id: string): Effect.Effect<AdminApp, NotFound | BadRequest | Conflict>
    restart(id: string): Effect.Effect<AdminApp, NotFound | BadRequest | Conflict>
    disable(id: string): Effect.Effect<AdminApp, NotFound>
    enable(id: string): Effect.Effect<AdminApp, NotFound | Conflict>
    setConfig(
      id: string,
      values: Readonly<Record<string, string>>,
    ): Effect.Effect<AdminApp, NotFound | BadRequest | Conflict>
    rotateKey(id: string): Effect.Effect<AppKey, NotFound | BadRequest>
    refresh(id: string): Effect.Effect<AdminApp, NotFound | BadRequest>
    logs(id: string, tail: number): Effect.Effect<AppLogs, NotFound | BadRequest>
    uninstall(id: string, deleteData: boolean): Effect.Effect<void, NotFound | BadRequest>
    skipEvents(id: string): Effect.Effect<AdminApp, NotFound>
  }
>()("@mosaik/portal-service/Installer") {
  static readonly layer = Layer.effect(
    Installer,
    Effect.gen(function* () {
      const core = yield* CoreClient
      const installations = yield* Installations
      const deployer = yield* Deployer
      const secrets = yield* Secrets
      const health = yield* Health
      const workspace = yield* Workspace
      const config = yield* PortalConfig
      const jobs = yield* FiberMap.make<string>()
      const inspections = new Map<string, { readonly done: Deferred.Deferred<InspectResult>; readonly at: number }>()

      const registered = (id: string) => fromCore(core.registry.get({ params: { id } }))
      /** The Portal's installation of the app; a configured app (in Core only) cannot be changed here. */
      const installed = (id: string) =>
        installations.get(id).pipe(
          Effect.flatMap(
            Option.match({
              onSome: Effect.succeed,
              onNone: () =>
                registered(id).pipe(
                  Effect.flatMap(() =>
                    Effect.fail(new BadRequest({ message: `"${id}" follows Core's configuration (CONFIGURED_APPS)` })),
                  ),
                ),
            }),
          ),
        )

      const toAdmin = Effect.fn(function* (app: RegistryApp, installation: Option.Option<Installation>) {
        const inst = Option.getOrNull(installation)
        const stored = inst === null ? [] : yield* installations.config(app.id)
        const declared = app.manifest?.portal.config ?? []
        const names = [...new Set([...declared.map((setting) => setting.name), ...stored.map((row) => row.name)])]
        const settings = names.map((name) => {
          const setting = declared.find((candidate) => candidate.name === name)
          const value = stored.find((row) => row.name === name)
          return new ConfigValue({
            name,
            description:
              setting?.description ?? (name === "DATABASE_URL" ? "The app's own database" : "Not declared by the app"),
            required: setting?.required ?? false,
            secret: value?.secret ?? setting?.secret ?? false,
            set: value !== undefined,
            value: value === undefined || value.secret ? null : value.value,
          })
        })
        const { health: state, lastSeenAt } = health.of(app.id)
        const deployment = app.status === "disabled" ? null : (inst?.deployment ?? null)
        return new AdminApp({
          id: app.id,
          kind: inst?.source ?? "configured",
          name: app.manifest?.name ?? app.id,
          version: app.manifest?.version ?? null,
          status: deployment ?? app.status,
          statusMessage:
            deployment !== null
              ? (inst?.deploymentMessage ?? null)
              : app.status === "pending"
                ? "Waiting for the app to register with its key"
                : null,
          health: app.status === "disabled" ? "unknown" : state,
          url: inst?.url ?? (inst === null ? app.upstream : null),
          image: inst?.image ?? null,
          digest: inst?.digest ?? null,
          previousImage: inst?.previousImage ?? null,
          database: inst?.databaseMode ?? "none",
          config: settings,
          manifest: app.manifest,
          createdAt: inst?.createdAt ?? app.createdAt,
          registeredAt: app.registeredAt,
          lastSeenAt,
          events: app.events,
        })
      })
      const admin = (id: string) =>
        Effect.all([registered(id), installations.get(id)]).pipe(
          Effect.flatMap(([app, installation]) => toAdmin(app, installation)),
          Effect.orDie,
        )

      // --- Manifests -----------------------------------------------------------------------

      const fetchManifest = (url: string) =>
        Effect.tryPromise({
          try: (signal) =>
            fetch(`${trimSlash(url)}${MANIFEST_PATH}`, {
              signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]),
            }),
          catch: (cause) => new BadRequest({ message: `Could not reach ${url}: ${String(cause)}` }),
        }).pipe(
          Effect.flatMap((response) =>
            response.ok
              ? Effect.promise(() => response.json() as Promise<unknown>)
              : Effect.fail(new BadRequest({ message: `${url}${MANIFEST_PATH}: HTTP ${response.status}` })),
          ),
          Effect.flatMap((json) =>
            decodeManifest(json).pipe(
              Effect.mapError((issue) => new BadRequest({ message: `Invalid manifest: ${issue.message}` })),
            ),
          ),
        )

      /** {@link manifestProblems}, and whether Core already has an app with the id. */
      const installProblems = Effect.fn(function* (manifest: AppManifest) {
        const existing = yield* fromCore(core.registry.get({ params: { id: manifest.id } })).pipe(
          Effect.as(true),
          Effect.catchTag("NotFound", () => Effect.succeed(false)),
        )
        return [
          ...manifestProblems(manifest),
          ...(existing ? [`An app with id "${manifest.id}" is already installed`] : []),
        ]
      })

      const requireInstallable = Effect.fn(function* (manifest: AppManifest) {
        const problems = yield* installProblems(manifest)
        if (problems.length > 0) return yield* new BadRequest({ message: problems.join(" ") })
      })

      // --- Images --------------------------------------------------------------------------

      const registryAuth = (server: string) =>
        installations
          .registry(server)
          .pipe(Effect.map(Option.map(({ username, password }) => ({ username, password: secrets.decrypt(password) }))))

      /** Pulls in the background; concurrent and repeated inspections of one image share the pull. */
      const inspection = (image: string) =>
        Effect.gen(function* () {
          const existing = inspections.get(image)
          if (existing !== undefined && Date.now() - existing.at < Duration.toMillis(INSPECTION_TTL))
            return existing.done
          const done = yield* Deferred.make<InspectResult>()
          inspections.set(image, { done, at: Date.now() })
          yield* deployer.pull(image, registryAuth).pipe(
            Effect.map((pulled): InspectResult => ({ ok: true, pulled })),
            Effect.catch((error) => Effect.succeed<InspectResult>({ ok: false, error: error.message })),
            Effect.flatMap((result) => {
              // Do not keep failures: the next attempt pulls again.
              if (!result.ok) inspections.delete(image)
              return Deferred.succeed(done, result)
            }),
            Effect.forkDetach,
          )
          return done
        })

      const pulled = (image: string) =>
        inspection(image).pipe(
          Effect.flatMap(Deferred.await),
          Effect.flatMap((result) =>
            result.ok ? Effect.succeed(result.pulled) : Effect.fail(new BadRequest({ message: result.error })),
          ),
        )

      const pulledManifest = (image: string) =>
        pulled(image).pipe(
          Effect.flatMap(({ digest, manifest }) =>
            Option.match(manifest, {
              onNone: () => Effect.fail(new BadRequest({ message: "The image has no Mosaik manifest" })),
              onSome: (manifest) => Effect.succeed({ digest, manifest }),
            }),
          ),
        )

      const requireDocker = Effect.gen(function* () {
        if (!(yield* deployer.available)) {
          return yield* new BadRequest({ message: "Docker is not available to the Portal (DOCKER_SOCKET)" })
        }
      })

      // --- Running image apps ----------------------------------------------------------------

      const environment = Effect.fn("Installer.environment")(function* (installation: Installation) {
        if (installation.keySecret === null) return yield* Effect.die(`App "${installation.appId}" has no key`)
        const stored = yield* installations.config(installation.appId)
        const values = Object.fromEntries(
          stored.map((row) => [row.name, row.secret ? secrets.decrypt(row.value) : row.value]),
        )
        const env: Record<string, string> = {
          ...values,
          NODE_ENV: "production",
          PORT: "3000",
          PLATFORM_URL: config.deploy.platformUrl,
          MOSAIK_APP_KEY: secrets.decrypt(installation.keySecret),
        }
        if (installation.databaseMode === "platform") {
          const database = yield* fromCore(core.registry.provisionDatabase({ params: { id: installation.appId } }))
          env.DATABASE_URL = database.url
        }
        if (Option.isSome(config.deploy.otelEndpoint))
          env.OTEL_EXPORTER_OTLP_ENDPOINT = config.deploy.otelEndpoint.value
        return env
      })

      /** Tells Core where the app now runs (`null`: nowhere), so the gateway routes it or stops. */
      const route = (id: string, upstream: string | null) =>
        fromCore(core.registry.update({ params: { id }, payload: { upstream } })).pipe(Effect.orDie)

      const start = (installation: Installation, digest: string) =>
        environment(installation).pipe(
          Effect.mapError((error) => new Error(error.message)),
          Effect.flatMap((env) => deployer.start(installation.appId, digest, env)),
        )

      /**
       * Starts the app's current digest. On failure: with `rollback`, the previous state is
       * restored and started again; otherwise the app is marked failed.
       */
      const deploy = (
        id: string,
        rollback: Option.Option<Pick<Installation, "image" | "digest" | "previousImage" | "previousDigest">>,
      ) =>
        Effect.gen(function* () {
          const installation = yield* installed(id).pipe(Effect.orDie)
          if (installation.digest === null) return yield* Effect.die(`App "${id}" has no image`)
          const started = yield* Effect.result(start(installation, installation.digest))
          if (started._tag === "Success") {
            yield* route(id, started.success)
            yield* installations.update(id, { deployment: null, deploymentMessage: null })
            yield* health.check(id, started.success)
            yield* Effect.logInfo(`Deployed app "${id}"`, { image: installation.image })
            return
          }
          const reason = started.failure.message
          yield* Effect.logWarning(`Deploying app "${id}" failed`, { image: installation.image, reason })
          // Keep the failed container stopped (for its logs) instead of letting Docker restart it.
          yield* deployer.stop(id).pipe(Effect.ignore)
          yield* route(id, null)
          if (Option.isNone(rollback) || rollback.value.digest === null) {
            yield* installations.update(id, { deployment: "failed", deploymentMessage: reason })
            return
          }
          const restoredState = yield* installations.update(id, {
            ...rollback.value,
            deploymentMessage: `Rolling back: ${reason}`,
          })
          const restored = yield* Effect.result(start(restoredState, rollback.value.digest))
          if (restored._tag === "Success") {
            yield* route(id, restored.success)
            yield* installations.update(id, { deployment: null, deploymentMessage: null })
            yield* Effect.logWarning(`Update of "${id}" to ${installation.image} failed and was rolled back`, {
              reason,
            })
            return
          }
          yield* installations.update(id, {
            deployment: "failed",
            deploymentMessage: `Update failed (${reason}) and so did the rollback (${restored.failure.message})`,
          })
        }).pipe(Effect.withSpan("Installer.deploy", { attributes: { "mosaik.app": id } }))

      /** Runs a deployment in the background; one at a time per app. */
      const startJob = Effect.fn(function* (id: string, message: string, job: Effect.Effect<void>) {
        if (yield* FiberMap.has(jobs, id))
          return yield* new Conflict({ message: `A deployment of "${id}" is in progress` })
        yield* installations.update(id, { deployment: "deploying", deploymentMessage: message })
        yield* FiberMap.run(jobs, id, job)
      })

      const imageApp = (installation: Installation) =>
        installation.source === "image"
          ? Effect.succeed(installation)
          : Effect.fail(new BadRequest({ message: `"${installation.appId}" is not run by the Portal` }))

      const idle = Effect.fn(function* (id: string) {
        if (yield* FiberMap.has(jobs, id))
          return yield* new Conflict({ message: `A deployment of "${id}" is in progress` })
      })

      /** Stores config values: secrets encrypted; an empty value keeps a stored secret. */
      const storeConfig = Effect.fn(function* (
        installation: Installation,
        values: Readonly<Record<string, string>>,
        declared: ReadonlyArray<ConfigSetting>,
      ) {
        const existing = yield* installations.config(installation.appId)
        const next = new Map(existing.map((row) => [row.name, row]))
        for (const [name, value] of Object.entries(values)) {
          const databaseUrl = name === "DATABASE_URL" && installation.databaseMode === "app"
          if (!CONFIG_NAME.test(name)) return yield* new BadRequest({ message: `Invalid setting name "${name}"` })
          if (RESERVED_ENV.has(name) && !databaseUrl) {
            return yield* new BadRequest({ message: `"${name}" is set by the Portal` })
          }
          const secret = databaseUrl || (declared.find((setting) => setting.name === name)?.secret ?? false)
          if (value === "") {
            if (!secret) next.delete(name)
            continue
          }
          next.set(name, { name, secret, value: secret ? secrets.encrypt(value) : value })
        }
        const missing = declared
          .filter((setting) => setting.required && !next.has(setting.name))
          .map((setting) => setting.name)
        if (installation.databaseMode === "app" && !next.has("DATABASE_URL")) missing.push("DATABASE_URL")
        if (missing.length > 0)
          return yield* new BadRequest({ message: `Required settings missing: ${missing.join(", ")}` })
        yield* installations.setConfig(installation.appId, [...next.values()] satisfies ReadonlyArray<StoredConfig>)
      })

      // --- Reconciliation ---------------------------------------------------------------------

      /** Recreates missing containers and follows changed ports. */
      const reconcile = Effect.gen(function* () {
        if (!(yield* deployer.available)) return
        const apps = yield* core.registry.list()
        for (const installation of yield* installations.list) {
          const app = apps.find((candidate) => candidate.id === installation.appId)
          if (
            installation.source !== "image" ||
            installation.deployment !== null ||
            app === undefined ||
            app.status === "disabled" ||
            (yield* FiberMap.has(jobs, installation.appId))
          )
            continue
          const address = yield* deployer
            .address(installation.appId)
            .pipe(Effect.orElseSucceed(() => Option.none<string>()))
          if (Option.isNone(address)) {
            yield* Effect.logWarning(`The container of "${installation.appId}" is not running; starting it again`)
            yield* startJob(
              installation.appId,
              "Restarting a stopped container",
              deploy(installation.appId, Option.none()),
            ).pipe(Effect.ignore)
          } else if (address.value !== app.upstream) {
            yield* route(installation.appId, address.value)
          }
        }
      }).pipe(Effect.withSpan("Installer.reconcile"))

      yield* reconcile.pipe(
        Effect.catchCause((cause) => Effect.logWarning("Reconciliation failed", cause)),
        Effect.repeat(Schedule.spaced(RECONCILE_EVERY)),
        Effect.forkScoped,
      )

      // --- Operations -------------------------------------------------------------------------

      return Installer.of({
        list: Effect.all([core.registry.list(), installations.list]).pipe(
          Effect.flatMap(([apps, all]) =>
            Effect.forEach(apps, (app) =>
              toAdmin(app, Option.fromUndefinedOr(all.find((installation) => installation.appId === app.id))),
            ),
          ),
          Effect.orDie,
        ),

        catalog: Effect.all([core.registry.list(), installations.list]).pipe(
          Effect.map(([apps, all]) =>
            apps.flatMap((app) => {
              const web = app.manifest?.portal.web
              const deploying = all.some((row) => row.appId === app.id && row.deployment !== null)
              return app.manifest && web && app.status !== "disabled" && !deploying
                ? [
                    new PublicApp({
                      id: app.id,
                      name: app.manifest.name,
                      description: app.manifest.description,
                      icon: app.manifest.portal.icon,
                      category: app.manifest.portal.category,
                      version: app.manifest.version,
                      access: app.manifest.access,
                      web,
                    }),
                  ]
                : []
            }),
          ),
          Effect.orDie,
        ),

        inspect: Effect.fn("Installer.inspect")(function* (source: AppSource) {
          if (source._tag === "Url") {
            const manifest = yield* fetchManifest(source.url)
            const problems = yield* installProblems(manifest)
            return new Inspection({ state: "ready", manifest, digest: null, error: null, problems })
          }
          yield* requireDocker
          const done = yield* inspection(source.image)
          const result = yield* Deferred.await(done).pipe(Effect.timeoutOption(INSPECT_WAIT))
          if (Option.isNone(result)) {
            return new Inspection({ state: "pulling", manifest: null, digest: null, error: null, problems: [] })
          }
          if (!result.value.ok) {
            return new Inspection({
              state: "failed",
              manifest: null,
              digest: null,
              error: result.value.error,
              problems: [],
            })
          }
          const { manifest, digest } = result.value.pulled
          if (Option.isNone(manifest)) {
            return new Inspection({
              state: "failed",
              manifest: null,
              digest,
              error: "The image has no Mosaik manifest (/app/mosaik-app.json). Build it from the app template.",
              problems: [],
            })
          }
          return new Inspection({
            state: "ready",
            manifest: manifest.value,
            digest,
            error: null,
            problems: yield* installProblems(manifest.value),
          })
        }),

        install: Effect.fn("Installer.install")(function* (request: InstallRequest) {
          if (request.source._tag === "Url") {
            const url = trimSlash(request.source.url)
            const manifest = yield* fetchManifest(url)
            yield* requireInstallable(manifest)
            const created = yield* fromCore(core.registry.create({ payload: { manifest, upstream: url } }))
            const installation = yield* installations.insert({ appId: manifest.id, source: "remote", url })
            yield* Effect.logInfo(`Installed remote app "${manifest.id}"`, { url })
            return new Installed({ app: yield* toAdmin(created.app, Option.some(installation)), key: created.key })
          }

          yield* requireDocker
          const image = request.source.image
          const { digest, manifest } = yield* pulledManifest(image)
          yield* requireInstallable(manifest)
          const database = manifest.database ? request.database : "none"
          if (manifest.database && database === "none") {
            return yield* new BadRequest({ message: "This app needs a database: choose the platform's or its own" })
          }
          if (database === "platform" && !(yield* core.registry.info().pipe(Effect.orDie)).databases) {
            return yield* new BadRequest({ message: "Platform databases are not configured; use the app's own" })
          }

          const created = yield* fromCore(core.registry.create({ payload: { manifest, upstream: null } }))
          const installation = yield* installations.insert({
            appId: manifest.id,
            source: "image",
            image,
            digest,
            databaseMode: database,
            keySecret: secrets.encrypt(created.key),
          })
          const stored = yield* Effect.result(storeConfig(installation, request.config, manifest.portal.config))
          if (stored._tag === "Failure") {
            yield* installations.delete(manifest.id)
            yield* fromCore(core.registry.delete({ params: { id: manifest.id } })).pipe(Effect.orDie)
            return yield* stored.failure
          }
          yield* startJob(manifest.id, `Starting ${image}`, deploy(manifest.id, Option.none())).pipe(Effect.orDie)
          yield* Effect.logInfo(`Installing image app "${manifest.id}"`, { image, digest })
          return new Installed({ app: yield* admin(manifest.id), key: null })
        }),

        upgrade: Effect.fn("Installer.upgrade")(function* (id: string, image: string) {
          const installation = yield* installed(id).pipe(Effect.flatMap(imageApp))
          yield* idle(id)
          const { digest, manifest } = yield* pulledManifest(image)
          if (manifest.id !== id)
            return yield* new BadRequest({ message: `The image is app "${manifest.id}", not "${id}"` })
          const problems = manifestProblems(manifest)
          if (problems.length > 0) return yield* new BadRequest({ message: problems.join(" ") })
          const stored = yield* installations.config(id)
          const missing = manifest.portal.config
            .filter((setting) => setting.required && !stored.some((row) => row.name === setting.name))
            .map((setting) => setting.name)
          if (missing.length > 0) {
            return yield* new BadRequest({ message: `Set these settings before upgrading: ${missing.join(", ")}` })
          }
          const before = {
            image: installation.image,
            digest: installation.digest,
            previousImage: installation.previousImage,
            previousDigest: installation.previousDigest,
          }
          yield* installations.update(id, {
            image,
            digest,
            previousImage: installation.image,
            previousDigest: installation.digest,
          })
          yield* startJob(id, `Updating to ${image}`, deploy(id, Option.some(before)))
          return yield* admin(id)
        }),

        rollback: Effect.fn("Installer.rollback")(function* (id: string) {
          const installation = yield* installed(id).pipe(Effect.flatMap(imageApp))
          if (installation.previousDigest === null)
            return yield* new BadRequest({ message: "There is no previous version" })
          yield* idle(id)
          const before = {
            image: installation.image,
            digest: installation.digest,
            previousImage: installation.previousImage,
            previousDigest: installation.previousDigest,
          }
          yield* installations.update(id, {
            image: installation.previousImage,
            digest: installation.previousDigest,
            previousImage: installation.image,
            previousDigest: installation.digest,
          })
          yield* startJob(id, `Rolling back to ${installation.previousImage}`, deploy(id, Option.some(before)))
          return yield* admin(id)
        }),

        restart: Effect.fn("Installer.restart")(function* (id: string) {
          yield* installed(id).pipe(Effect.flatMap(imageApp))
          yield* startJob(id, "Restarting", deploy(id, Option.none()))
          return yield* admin(id)
        }),

        disable: Effect.fn("Installer.disable")(function* (id: string) {
          const installation = yield* installations.get(id)
          yield* fromCore(core.registry.update({ params: { id }, payload: { enabled: false } }))
          if (Option.isSome(installation) && installation.value.source === "image") {
            yield* FiberMap.remove(jobs, id)
            yield* deployer.stop(id).pipe(Effect.ignore)
            yield* installations.update(id, { deployment: null, deploymentMessage: null })
          }
          return yield* admin(id)
        }),

        enable: Effect.fn("Installer.enable")(function* (id: string) {
          const app = yield* registered(id)
          if (app.status !== "disabled") return yield* admin(id)
          yield* fromCore(core.registry.update({ params: { id }, payload: { enabled: true } }))
          const installation = yield* installations.get(id)
          if (Option.isSome(installation) && installation.value.source === "image") {
            yield* startJob(id, "Starting", deploy(id, Option.none()))
          }
          return yield* admin(id)
        }),

        setConfig: Effect.fn("Installer.setConfig")(function* (id: string, values: Readonly<Record<string, string>>) {
          const installation = yield* installed(id).pipe(Effect.flatMap(imageApp))
          const app = yield* registered(id)
          yield* storeConfig(installation, values, app.manifest?.portal.config ?? [])
          // Containers read their environment at start.
          if (app.status !== "disabled") yield* startJob(id, "Applying new settings", deploy(id, Option.none()))
          return yield* admin(id)
        }),

        rotateKey: Effect.fn("Installer.rotateKey")(function* (id: string) {
          const installation = yield* installed(id)
          const { key } = yield* fromCore(core.registry.rotateKey({ params: { id } }))
          if (installation.source === "image") {
            yield* installations.update(id, { keySecret: secrets.encrypt(key) })
            if ((yield* registered(id)).status !== "disabled") {
              yield* startJob(id, "Restarting with a new key", deploy(id, Option.none())).pipe(Effect.ignore)
            }
          }
          return new AppKey({ key })
        }),

        refresh: Effect.fn("Installer.refresh")(function* (id: string) {
          const installation = yield* installed(id)
          if (installation.source !== "remote" || installation.url === null) {
            return yield* new BadRequest({ message: "Only apps hosted elsewhere are refreshed by URL" })
          }
          const manifest = yield* fetchManifest(installation.url)
          yield* fromCore(core.registry.register({ params: { id }, payload: manifest }))
          return yield* admin(id)
        }),

        logs: Effect.fn("Installer.logs")(function* (id: string, tail: number) {
          yield* installed(id).pipe(Effect.flatMap(imageApp))
          const lines = yield* deployer
            .logs(id, Math.min(Math.max(tail, 1), 2000))
            .pipe(Effect.mapError((error) => new BadRequest({ message: error.message })))
          return new AppLogs({ lines })
        }),

        uninstall: Effect.fn("Installer.uninstall")(function* (id: string, deleteData: boolean) {
          const installation = yield* installed(id)
          yield* FiberMap.remove(jobs, id)
          if (installation.source === "image") yield* deployer.remove(id).pipe(Effect.ignore)
          if (deleteData && installation.databaseMode === "platform") {
            yield* fromCore(core.registry.dropDatabase({ params: { id } }))
          }
          yield* fromCore(core.registry.delete({ params: { id } }))
          yield* installations.delete(id)
          // Nobody keeps an uninstalled app pinned; one installed later under the same id starts afresh.
          yield* workspace.forgetApp(id)
          yield* Effect.logInfo(`Uninstalled app "${id}"`, { deleteData })
        }),

        skipEvents: Effect.fn("Installer.skipEvents")(function* (id: string) {
          yield* fromCore(core.registry.skipEvent({ params: { id } }))
          return yield* admin(id)
        }),
      })
    }),
  )
}
