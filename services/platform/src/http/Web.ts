import { AuditEventInput } from "@mosaik/auth/contract"
import { InternalClient } from "@mosaik/auth/server"
import { CurrentPrincipal, Forbidden, ownerPermission, type Principal, type PrincipalUser } from "@mosaik/core"
import { AccessAdmin, canManageApp, PlatformWebApi } from "@mosaik/platform/contract"
import { Effect, Schedule, type Schema } from "effect"
import { HttpApiBuilder } from "effect/http-api"
import { AccessRequests } from "../AccessRequests"
import { Ownership } from "../Ownership"
import { SettingsStore } from "../Settings"
import { AppStorage } from "../Storage"

/** Records changes in the central audit log; a failure to record is logged, not returned. */
const makeAudit = Effect.gen(function* () {
  const auth = yield* InternalClient
  const audit = (action: string, target: string, details: Record<string, Schema.Json> = {}) =>
    Effect.gen(function* () {
      const principal = yield* CurrentPrincipal
      yield* auth.internal
        .recordAudit({
          payload: new AuditEventInput({ app: "platform", action, target, actor: principal.user, details }),
        })
        .pipe(
          Effect.retry({ schedule: Schedule.exponential("200 millis"), times: 3 }),
          Effect.catchCause((cause) => Effect.logError("Failed to record audit entry", action, cause)),
        )
    })
  return { audit }
})

/** The logged-in user: these endpoints let in logged-in users only. */
const currentUser: Effect.Effect<PrincipalUser, never, CurrentPrincipal> = Effect.flatMap(
  CurrentPrincipal,
  (principal) =>
    principal.user === null
      ? Effect.die("AccessControlUsers lets only logged-in users in")
      : Effect.succeed(principal.user),
)

export const AccessHandlers = HttpApiBuilder.group(
  PlatformWebApi,
  "access",
  Effect.fn(function* (handlers) {
    const requests = yield* AccessRequests
    return handlers.handleAll({
      mine: () => Effect.flatMap(currentUser, (user) => requests.mine(user.id)),
      request: ({ payload }) =>
        Effect.flatMap(CurrentPrincipal, (principal) =>
          requests.request(principal, payload.app, payload.role, payload.message),
        ),
    })
  }),
)

export const AccessReviewHandlers = HttpApiBuilder.group(
  PlatformWebApi,
  "accessReview",
  Effect.fn(function* (handlers) {
    const requests = yield* AccessRequests
    const { audit } = yield* makeAudit
    return handlers.handleAll({
      list: ({ query }) => Effect.flatMap(CurrentPrincipal, (principal) => requests.list(principal, query)),
      approve: ({ params, payload }) =>
        Effect.flatMap(CurrentPrincipal, (principal) => requests.approve(principal, params.id, payload.role)).pipe(
          Effect.tap((request) => audit("access.approve", request.userEmail, { app: request.app, role: payload.role })),
        ),
      decline: ({ params, payload }) =>
        Effect.flatMap(CurrentPrincipal, (principal) => requests.decline(principal, params.id, payload.reason)).pipe(
          Effect.tap((request) => audit("access.decline", request.userEmail, { app: request.app })),
        ),
    })
  }),
)

/** Who can use an app: about it, and for its owners and admins, its members. */
export const AppsHandlers = HttpApiBuilder.group(
  PlatformWebApi,
  "apps",
  Effect.fn(function* (handlers) {
    const ownership = yield* Ownership
    const { audit } = yield* makeAudit
    return handlers.handleAll({
      list: () => Effect.flatMap(CurrentPrincipal, (principal) => ownership.managed(principal)),
      about: ({ params }) => ownership.about(params.id),
      members: ({ params }) => Effect.flatMap(CurrentPrincipal, (principal) => ownership.members(principal, params.id)),
      setMemberRoles: ({ params, payload }) =>
        Effect.flatMap(CurrentPrincipal, (principal) =>
          ownership.setMemberRoles(principal, params.id, params.user, payload.roles),
        ).pipe(
          Effect.tap((user) => audit("access.set-roles", user.email, { app: params.id, roles: [...payload.roles] })),
          Effect.asVoid,
        ),
      people: ({ params, query }) =>
        Effect.flatMap(CurrentPrincipal, (principal) => ownership.people(principal, params.id, query.q)),
    })
  }),
)

/** An app's settings, for its owners and admins: changes apply while the app runs, and are audited. */
export const SettingsHandlers = HttpApiBuilder.group(
  PlatformWebApi,
  "settings",
  Effect.fn(function* (handlers) {
    const store = yield* SettingsStore
    const { audit } = yield* makeAudit
    /** The same people who decide who can use the app. */
    const check = (app: string) =>
      Effect.flatMap(CurrentPrincipal, (principal) =>
        canManageApp(principal, app) ? Effect.void : Effect.fail(new Forbidden({ permission: ownerPermission(app) })),
      )
    return handlers.handleAll({
      get: ({ params }) => Effect.andThen(check(params.id), store.view(params.id)),
      set: ({ params, payload }) =>
        Effect.gen(function* () {
          yield* check(params.id)
          const { settings, changes } = yield* store.set(params.id, yield* currentUser, payload)
          if (changes.length > 0) {
            yield* audit("app.settings.set", params.id, {
              changes: changes.map(({ name, from, to }) => ({ name, from, to })),
            })
          }
          return settings
        }),
    })
  }),
)

/** An app's storage: its usage for the people who manage it, its limit for admins. */
export const StorageHandlers = HttpApiBuilder.group(
  PlatformWebApi,
  "storage",
  Effect.fn(function* (handlers) {
    const storage = yield* AppStorage
    const { audit } = yield* makeAudit
    const check = (allowed: (principal: Principal) => boolean, permission: string) =>
      Effect.flatMap(CurrentPrincipal, (principal) =>
        allowed(principal) ? Effect.void : Effect.fail(new Forbidden({ permission })),
      )
    return handlers.handleAll({
      usage: ({ params }) =>
        Effect.andThen(
          check((principal) => canManageApp(principal, params.id), ownerPermission(params.id)),
          storage.usage(params.id),
        ),
      setLimit: ({ params, payload }) =>
        Effect.gen(function* () {
          yield* check((principal) => principal.can(AccessAdmin.manage), AccessAdmin.manage)
          const usage = yield* storage.setLimit(params.id, payload.limitBytes)
          yield* audit("app.storage.set-limit", params.id, { limitBytes: payload.limitBytes })
          return usage
        }),
    })
  }),
)
