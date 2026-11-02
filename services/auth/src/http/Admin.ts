import { AdminApi, AuditEventInput, admin } from "@mosaik/auth/contract"
import { CurrentPrincipal, NotFound } from "@mosaik/core"
import { Effect, Layer, Option, type Schema } from "effect"
import { HttpApiBuilder } from "effect/http-api"
import { AgentConnections } from "../agents/AgentConnections"
import { AuditLog } from "../rbac/AuditLog"
import { Registry } from "../rbac/Registry"
import { Roles } from "../rbac/Roles"
import { Users } from "../rbac/Users"

/** Records an admin action, attributed to the current principal. */
const recordAdminAction = Effect.fn("Admin.audit")(function* (
  action: string,
  target: string,
  details: Record<string, Schema.Json> = {},
) {
  const audit = yield* AuditLog
  const principal = yield* CurrentPrincipal
  yield* audit.record(
    new AuditEventInput({ app: admin.id, action, target, actor: principal.user, agent: principal.agent, details }),
  )
})

const UsersHandlers = HttpApiBuilder.group(
  AdminApi,
  "users",
  Effect.fn(function* (handlers) {
    const users = yield* Users
    return handlers.handleAll({
      list: () => users.list,
      create: Effect.fn(function* ({ payload }) {
        const user = yield* users.create(payload)
        yield* recordAdminAction("users.create", user.email, { roles: [...user.roles] })
        return user
      }),
      setRoles: Effect.fn(function* ({ params, payload }) {
        const user = yield* users.setRoles(params.id, payload.roles)
        yield* recordAdminAction("users.set-roles", user.email, { roles: [...user.roles] })
        return user
      }),
      delete: Effect.fn(function* ({ params }) {
        const principal = yield* CurrentPrincipal
        const user = yield* users.get(params.id)
        yield* users.delete(params.id, principal.user?.id ?? null)
        yield* recordAdminAction("users.delete", user.email)
      }),
    })
  }),
)

const RolesHandlers = HttpApiBuilder.group(
  AdminApi,
  "roles",
  Effect.fn(function* (handlers) {
    const roles = yield* Roles
    return handlers.handleAll({
      list: () => roles.list,
      create: Effect.fn(function* ({ payload }) {
        const role = yield* roles.create(payload)
        yield* recordAdminAction("roles.create", role.id)
        return role
      }),
      update: Effect.fn(function* ({ params, payload }) {
        const role = yield* roles.update(params.id, payload)
        yield* recordAdminAction("roles.update", role.id, { name: role.name })
        return role
      }),
      setGrants: Effect.fn(function* ({ params, payload }) {
        const before = yield* roles.get(params.id)
        const role = yield* roles.setGrants(params.id, payload.grants)
        yield* recordAdminAction("roles.set-grants", role.id, {
          added: role.grants.filter((g) => !before.grants.includes(g)),
          removed: before.grants.filter((g) => !role.grants.includes(g)),
        })
        return role
      }),
      delete: Effect.fn(function* ({ params }) {
        yield* roles.delete(params.id)
        yield* recordAdminAction("roles.delete", params.id)
      }),
    })
  }),
)

const CatalogHandlers = HttpApiBuilder.group(
  AdminApi,
  "catalog",
  Effect.fn(function* (handlers) {
    const registry = yield* Registry
    return handlers.handle("list", () => registry.catalog)
  }),
)

const AuditHandlers = HttpApiBuilder.group(
  AdminApi,
  "audit",
  Effect.fn(function* (handlers) {
    const audit = yield* AuditLog
    return handlers.handle("list", ({ query }) => audit.list(query))
  }),
)

const AgentsHandlers = HttpApiBuilder.group(
  AdminApi,
  "agents",
  Effect.fn(function* (handlers) {
    const connections = yield* AgentConnections
    return handlers
      .handle("list", () => connections.list(Option.none()))
      .handle(
        "disconnect",
        Effect.fn(function* ({ params }) {
          const connection = yield* connections.disconnect(params.id, Option.none())
          if (Option.isNone(connection)) return yield* new NotFound({ resource: "AI client connection", id: params.id })
          yield* recordAdminAction("agents.disconnect", connection.value.user.email, {
            client: connection.value.client,
          })
        }),
      )
  }),
)

export const AdminHandlers = Layer.mergeAll(
  UsersHandlers,
  RolesHandlers,
  CatalogHandlers,
  AuditHandlers,
  AgentsHandlers,
)
