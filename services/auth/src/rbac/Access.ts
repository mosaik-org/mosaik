import { BuiltInRoles, isGranted, Principal, PrincipalUser } from "@mosaik/core"
import { Context, Effect, Layer, Option, Schema } from "effect"
import { SqlClient, SqlSchema } from "effect/sql"

const GrantRow = Schema.Struct({ grantKey: Schema.String })
const RoleGrantRow = Schema.Struct({ roleId: Schema.String, grantKey: Schema.String })

/**
 * Roles whose grants cover `permission`. `explicit`: only through grants in the
 * permission's app (`sales:*`, not `*`), the roles of people actually responsible for it.
 */
export const rolesGranting = (
  roleGrants: ReadonlyArray<{ readonly roleId: string; readonly grantKey: string }>,
  permission: string,
  explicit = false,
): ReadonlySet<string> => {
  const namespace = `${permission.slice(0, permission.indexOf(":"))}:`
  const byRole = new Map<string, Array<string>>()
  for (const { roleId, grantKey } of roleGrants) {
    if (explicit && !grantKey.startsWith(namespace)) continue
    byRole.set(roleId, [...(byRole.get(roleId) ?? []), grantKey])
  }
  return new Set([...byRole].filter(([, grants]) => isGranted(grants, permission)).map(([roleId]) => roleId))
}

/** Resolves principals: who the caller is plus the union of grants of all their roles. */
export class Access extends Context.Service<
  Access,
  {
    principalFor(user: Option.Option<PrincipalUser>): Effect.Effect<Principal>
    /** A user's grants, if the user exists. */
    grantsOf(userId: string): Effect.Effect<Option.Option<ReadonlyArray<string>>>
    /** Users holding `permission`, or every user for `null` (see {@link rolesGranting} for `explicit`). */
    holders(permission: string | null, explicit?: boolean): Effect.Effect<ReadonlyArray<PrincipalUser>>
  }
>()("@mosaik/auth-service/Access") {
  static readonly layer = Layer.effect(
    Access,
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient

      const anonymousGrants = SqlSchema.findAll({
        Request: Schema.Void,
        Result: GrantRow,
        execute: () => sql`SELECT grant_key FROM role_grants WHERE role_id = ${BuiltInRoles.anonymous}`,
      })

      const userGrants = SqlSchema.findAll({
        Request: Schema.String,
        Result: GrantRow,
        execute: (userId) => sql`
          SELECT DISTINCT grant_key FROM role_grants
          WHERE role_id IN (${BuiltInRoles.anonymous}, ${BuiltInRoles.authenticated})
             OR role_id IN (SELECT role_id FROM user_roles WHERE user_id = ${userId})
        `,
      })

      const allRoleGrants = SqlSchema.findAll({
        Request: Schema.Void,
        Result: RoleGrantRow,
        execute: () => sql`SELECT role_id, grant_key FROM role_grants`,
      })
      const allUsers = SqlSchema.findAll({
        Request: Schema.Void,
        Result: PrincipalUser,
        execute: () => sql`SELECT id, email, name, image FROM "user" ORDER BY id`,
      })
      const usersInRoles = SqlSchema.findAll({
        Request: Schema.Array(Schema.String),
        Result: PrincipalUser,
        execute: (roles) => sql`
          SELECT DISTINCT u.id, u.email, u.name, u.image
          FROM "user" u JOIN user_roles ur ON ur.user_id = u.id
          WHERE ur.role_id IN ${sql.in(roles)}
          ORDER BY u.id
        `,
      })

      return Access.of({
        grantsOf: Effect.fn("Access.grantsOf")(function* (userId: string) {
          const exists = yield* sql`SELECT 1 FROM "user" WHERE id = ${userId}`.pipe(Effect.orDie)
          if (exists.length === 0) return Option.none()
          const rows = yield* userGrants(userId).pipe(Effect.orDie)
          return Option.some(rows.map((row) => row.grantKey))
        }),

        holders: Effect.fn("Access.holders")(function* (permission: string | null, explicit = false) {
          if (permission === null) return yield* allUsers().pipe(Effect.orDie)
          const roles = rolesGranting(yield* allRoleGrants().pipe(Effect.orDie), permission, explicit)
          // Implicit roles apply to every user.
          if (roles.has(BuiltInRoles.anonymous) || roles.has(BuiltInRoles.authenticated)) {
            return yield* allUsers().pipe(Effect.orDie)
          }
          return roles.size === 0 ? [] : yield* usersInRoles([...roles]).pipe(Effect.orDie)
        }),

        principalFor: Effect.fn("Access.principalFor")(function* (user: Option.Option<PrincipalUser>) {
          const rows = yield* Option.match(user, {
            onNone: () => anonymousGrants(),
            onSome: (user) => userGrants(user.id),
          }).pipe(Effect.orDie)
          return new Principal({ user: Option.getOrNull(user), grants: rows.map((row) => row.grantKey) })
        }),
      })
    }),
  )
}
