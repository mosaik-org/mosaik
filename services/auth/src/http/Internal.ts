import { AccessChange, InternalApi } from "@mosaik/auth/contract"
import { NotFound, scopeGrants } from "@mosaik/core"
import { Live } from "@mosaik/server"
import { Effect, Option } from "effect"
import { HttpApiBuilder } from "effect/http-api"
import { AccessFeed } from "../AccessFeed"
import { BetterAuth } from "../BetterAuth"
import { Access } from "../rbac/Access"
import { AuditLog } from "../rbac/AuditLog"
import { Members } from "../rbac/Members"
import { Registry } from "../rbac/Registry"
import { Users } from "../rbac/Users"
import { SigningKeys } from "../SigningKeys"

export const InternalHandlers = HttpApiBuilder.group(
  InternalApi,
  "internal",
  Effect.fn(function* (handlers) {
    const auth = yield* BetterAuth
    const access = yield* Access
    const keys = yield* SigningKeys
    const registry = yield* Registry
    const audit = yield* AuditLog
    const users = yield* Users
    const members = yield* Members
    const feed = yield* AccessFeed

    return handlers.handleAll({
      issueToken: Effect.fn("Internal.issueToken")(function* ({ payload }) {
        const headers = new Headers(payload.cookie === null ? {} : { cookie: payload.cookie })
        const user = yield* auth.getSessionUser(headers).pipe(Effect.orDie)
        const principal = yield* access.principalFor(user)
        const grants = payload.scope === null ? principal.grants : scopeGrants(principal.grants, payload.scope)
        return yield* keys.sign({ user: principal.user, grants }, payload.audience)
      }),
      // Within Bun's idle timeout (60 s), and often enough for the gateway to notice a dead connection.
      accessStream: () => Live.eventStream(AccessChange, feed.changes, { heartbeat: "20 seconds" }),
      registerApp: ({ payload }) => registry.register(payload).pipe(Effect.orDie),
      app: ({ params }) =>
        registry.find(params.id).pipe(
          Effect.flatMap(
            Option.match({
              onNone: () => Effect.fail(new NotFound({ resource: "app", id: params.id })),
              onSome: Effect.succeed,
            }),
          ),
        ),
      appAccess: ({ params }) => members.of(params.id),
      setAppRoles: ({ params, payload }) => members.setRoles(params.id, params.user, payload.roles),
      unregisterApp: ({ params }) => registry.unregister(params.id),
      recordAudit: ({ payload }) => audit.record(payload),
      lookupUsers: ({ payload }) => users.lookup(payload.ids),
      addRole: Effect.fn("Internal.addRole")(function* ({ params, payload }) {
        const user = yield* users.get(params.id)
        if (!user.roles.includes(payload.role)) yield* users.setRoles(params.id, [...user.roles, payload.role])
      }),
      searchUsers: ({ payload }) => users.search(payload.query),
      usersWithPermission: ({ payload }) => access.holders(payload.permission, payload.explicit ?? false),
    })
  }),
)
