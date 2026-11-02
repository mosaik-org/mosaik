import { AuditEventInput } from "@mosaik/auth/contract"
import { InternalClient } from "@mosaik/auth/server"
import { CurrentPrincipal, Forbidden, NotFound, ownerPermission, type PrincipalUser } from "@mosaik/core"
import { canManageApp } from "@mosaik/platform/contract"
import { AppUsageStats, Catalog, PortalWebApi, portalApp } from "@mosaik/portal/contract"
import { Effect, Schedule, type Schema } from "effect"
import { HttpApiBuilder } from "effect/http-api"
import { Installations } from "../Installations"
import { Installer } from "../Installer"
import { Secrets } from "../Secrets"
import { Workspace } from "../Workspace"

/** Records changes in the central audit log; a failure to record is logged, not returned. */
const makeAudit = Effect.gen(function* () {
  const auth = yield* InternalClient
  const audit = (action: string, target: string, details: Record<string, Schema.Json> = {}) =>
    Effect.gen(function* () {
      const principal = yield* CurrentPrincipal
      yield* auth.internal
        .recordAudit({
          payload: new AuditEventInput({
            app: portalApp.id,
            action,
            target,
            actor: principal.user,
            agent: principal.agent,
            details,
          }),
        })
        .pipe(
          Effect.retry({ schedule: Schedule.exponential("200 millis"), times: 3 }),
          Effect.catchCause((cause) => Effect.logError("Failed to record audit entry", action, cause)),
        )
    })
  const audited =
    <A, E, R>(action: string, target: string, details: Record<string, Schema.Json> = {}) =>
    (effect: Effect.Effect<A, E, R>) =>
      Effect.tap(effect, () => audit(action, target, details))
  return { audit, audited }
})

/** The logged-in user: these endpoints let in logged-in users only. */
const currentUser: Effect.Effect<PrincipalUser, never, CurrentPrincipal> = Effect.flatMap(
  CurrentPrincipal,
  (principal) =>
    principal.user === null
      ? Effect.die("AccessControlUsers lets only logged-in users in")
      : Effect.succeed(principal.user),
)

/** Installed apps for the shell: metadata, where their browser bundles are, and the categories admins chose. */
export const CatalogHandlers = HttpApiBuilder.group(
  PortalWebApi,
  "catalog",
  Effect.fn(function* (handlers) {
    const installer = yield* Installer
    const workspace = yield* Workspace
    return handlers.handle("apps", () =>
      Effect.all({ apps: installer.catalog, categories: workspace.categories }, { concurrency: 2 }).pipe(
        Effect.map((catalog) => new Catalog(catalog)),
      ),
    )
  }),
)

export const WorkspaceHandlers = HttpApiBuilder.group(
  PortalWebApi,
  "workspace",
  Effect.fn(function* (handlers) {
    const workspace = yield* Workspace
    return handlers.handleAll({
      apps: () => Effect.flatMap(currentUser, (user) => workspace.apps(user.id)),
      setPinned: ({ payload }) => Effect.flatMap(currentUser, (user) => workspace.setPinned(user.id, payload.apps)),
      opened: ({ params }) => Effect.flatMap(currentUser, (user) => workspace.opened(user.id, params.id)),
      popularity: () => workspace.popularity,
    })
  }),
)

/** The Portal's part of an app's page, for its owners and admins: usage, and where the directory lists it. */
export const DirectoryHandlers = HttpApiBuilder.group(
  PortalWebApi,
  "directory",
  Effect.fn(function* (handlers) {
    const workspace = yield* Workspace
    const { audit } = yield* makeAudit

    const manages = (app: string) =>
      Effect.flatMap(CurrentPrincipal, (principal) =>
        canManageApp(principal, app) ? Effect.void : Effect.fail(new Forbidden({ permission: ownerPermission(app) })),
      )

    return handlers.handleAll({
      usage: ({ params }) =>
        manages(params.id).pipe(
          Effect.andThen(workspace.usage),
          Effect.map(
            (usage) =>
              usage.find((entry) => entry.app === params.id) ??
              new AppUsageStats({ app: params.id, activeUsers: 0, users: 0, opens: 0, lastOpenedAt: null }),
          ),
        ),
      setCategory: ({ params, payload }) =>
        manages(params.id).pipe(
          Effect.andThen(workspace.setCategory(params.id, payload.category)),
          Effect.tap(() => audit("apps.category", params.id, { category: payload.category })),
        ),
    })
  }),
)

export const AdminHandlers = HttpApiBuilder.group(
  PortalWebApi,
  "admin",
  Effect.fn(function* (handlers) {
    const installer = yield* Installer
    const installations = yield* Installations
    const secrets = yield* Secrets
    const workspace = yield* Workspace
    const { audit, audited } = yield* makeAudit

    return handlers.handleAll({
      apps: () => installer.list,
      inspect: ({ payload }) => installer.inspect(payload.source),

      install: ({ payload }) =>
        installer.install(payload).pipe(
          Effect.tap((installed) =>
            audit("apps.install", installed.app.id, {
              kind: installed.app.kind,
              source: payload.source._tag === "Url" ? payload.source.url : payload.source.image,
              database: payload.database,
            }),
          ),
        ),

      upgrade: ({ params, payload }) =>
        installer.upgrade(params.id, payload.image).pipe(audited("apps.upgrade", params.id, { image: payload.image })),
      rollback: ({ params }) => installer.rollback(params.id).pipe(audited("apps.rollback", params.id)),
      restart: ({ params }) => installer.restart(params.id).pipe(audited("apps.restart", params.id)),
      disable: ({ params }) => installer.disable(params.id).pipe(audited("apps.disable", params.id)),
      enable: ({ params }) => installer.enable(params.id).pipe(audited("apps.enable", params.id)),
      setConfig: ({ params, payload }) =>
        installer
          .setConfig(params.id, payload.values)
          .pipe(audited("apps.config", params.id, { settings: Object.keys(payload.values) })),
      rotateKey: ({ params }) => installer.rotateKey(params.id).pipe(audited("apps.rotate-key", params.id)),
      refresh: ({ params }) => installer.refresh(params.id).pipe(audited("apps.refresh", params.id)),
      skipEvents: ({ params }) => installer.skipEvents(params.id).pipe(audited("apps.skip-events", params.id)),
      logs: ({ params, query }) => installer.logs(params.id, query.tail ?? 300),
      uninstall: ({ params, query }) =>
        installer
          .uninstall(params.id, query.deleteData === "true")
          .pipe(audited("apps.uninstall", params.id, { deleteData: query.deleteData === "true" })),

      usage: () => workspace.usage,

      registries: () => installations.registries,
      setRegistry: ({ payload }) =>
        installations
          .setRegistry(payload.server, payload.username, secrets.encrypt(payload.password))
          .pipe(audited("registries.set", payload.server, { username: payload.username })),
      deleteRegistry: Effect.fn(function* ({ query }) {
        if (!(yield* installations.deleteRegistry(query.server))) {
          return yield* new NotFound({ resource: "registry", id: query.server })
        }
        yield* audit("registries.delete", query.server)
      }),
    })
  }),
)
