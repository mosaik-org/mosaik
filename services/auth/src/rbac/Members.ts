import { AppAccess, AppMember, RoleRef } from "@mosaik/auth/contract"
import {
  BadRequest,
  BuiltInRoles,
  NotFound,
  ownerPermission,
  ownerRoleId,
  PrincipalUser,
  type UserId,
} from "@mosaik/core"
import { Array as Arr, Context, Effect, Layer, Option, Schema } from "effect"
import { SqlClient, SqlSchema } from "effect/sql"
import { rolesGranting } from "./Access"
import { Registry } from "./Registry"

const RoleRow = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  appId: Schema.NullOr(Schema.String),
  stale: Schema.Boolean,
})
const GrantRow = Schema.Struct({ roleId: Schema.String, grantKey: Schema.String })
const HolderRow = Schema.Struct({ ...PrincipalUser.fields, roleId: Schema.String })

const IMPLICIT = new Set<string>([BuiltInRoles.anonymous, BuiltInRoles.authenticated])

/**
 * Who can use an app: the people with its roles, and those whose other roles name it.
 * Lets an app's owners give its roles without touching anyone's other roles.
 */
export class Members extends Context.Service<
  Members,
  {
    of(app: string): Effect.Effect<AppAccess, NotFound>
    /** Sets which of the app's roles the user has; only the differences are written. */
    setRoles(app: string, user: UserId, roles: ReadonlyArray<string>): Effect.Effect<void, NotFound | BadRequest>
  }
>()("@mosaik/auth-service/Members") {
  static readonly layer = Layer.effect(
    Members,
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient
      const registry = yield* Registry

      const allRoles = SqlSchema.findAll({
        Request: Schema.Void,
        Result: RoleRow,
        execute: () => sql`SELECT id, name, app_id, stale FROM roles`,
      })
      const allGrants = SqlSchema.findAll({
        Request: Schema.Void,
        Result: GrantRow,
        execute: () => sql`SELECT role_id, grant_key FROM role_grants`,
      })
      const holders = SqlSchema.findAll({
        Request: Schema.Array(Schema.String),
        Result: HolderRow,
        execute: (roles) => sql`
          SELECT u.id, u.email, u.name, u.image, ur.role_id
          FROM user_roles ur JOIN "user" u ON u.id = ur.user_id
          WHERE ur.role_id IN ${sql.in(roles)}
        `,
      })

      const registeredApp = (app: string) =>
        registry.find(app).pipe(
          Effect.flatMap(
            Option.match({
              onNone: () => Effect.fail(new NotFound({ resource: "app", id: app })),
              onSome: Effect.succeed,
            }),
          ),
        )

      return Members.of({
        of: Effect.fn("Members.of")(function* (app: string) {
          const registered = yield* registeredApp(app)
          const [roles, grants] = yield* Effect.all([allRoles(), allGrants()], { concurrency: 2 }).pipe(Effect.orDie)
          const opening = rolesGranting(grants, registered.access)
          const owning = rolesGranting(grants, ownerPermission(app), true)
          const openTo = opening.has(BuiltInRoles.anonymous)
            ? "anonymous"
            : opening.has(BuiltInRoles.authenticated)
              ? "authenticated"
              : null

          // Other roles count when they name the app: superadmins' `*` reaches every app.
          const naming = rolesGranting(grants, registered.access, true)
          const own = new Set(roles.filter((role) => role.appId === app).map((role) => role.id))
          const others = new Map(
            roles
              .filter((role) => role.appId === null && !IMPLICIT.has(role.id))
              .filter((role) => naming.has(role.id) || owning.has(role.id))
              .map((role) => [role.id, new RoleRef({ id: role.id, name: role.name })]),
          )
          const relevant = [...own, ...others.keys()]
          const rows = relevant.length === 0 ? [] : yield* holders(relevant).pipe(Effect.orDie)

          const byUser = new Map<string, { user: PrincipalUser; roles: Array<string>; via: Array<RoleRef> }>()
          for (const row of rows) {
            const { roleId, ...user } = row
            const entry = byUser.get(user.id) ?? { user: new PrincipalUser(user), roles: [], via: [] }
            const other = others.get(roleId)
            if (other === undefined) entry.roles.push(roleId)
            else entry.via.push(other)
            byUser.set(user.id, entry)
          }
          const members = [...byUser.values()]
            .map(
              (entry) =>
                new AppMember({
                  user: entry.user,
                  roles: entry.roles.sort(),
                  via: entry.via,
                  owner: entry.roles.includes(ownerRoleId(app)) || entry.via.some((role) => owning.has(role.id)),
                }),
            )
            .sort((a, b) => Number(b.owner) - Number(a.owner) || a.user.name.localeCompare(b.user.name))
          return new AppAccess({ app: registered, openTo, members })
        }),

        setRoles: Effect.fn("Members.setRoles")(function* (app: string, user: UserId, roles: ReadonlyArray<string>) {
          const registered = yield* registeredApp(app)
          const exists = yield* sql`SELECT 1 FROM "user" WHERE id = ${user}`.pipe(Effect.orDie)
          if (exists.length === 0) return yield* new NotFound({ resource: "user", id: user })

          const current = new Set(
            (yield* sql<{ roleId: string }>`
              SELECT ur.role_id FROM user_roles ur JOIN roles r ON r.id = ur.role_id
              WHERE ur.user_id = ${user} AND r.app_id = ${app}
            `.pipe(Effect.orDie)).map((row) => row.roleId),
          )
          const wanted = new Set(roles)
          for (const role of wanted) {
            const known = registered.roles.find((candidate) => candidate.id === role)
            if (known === undefined) {
              return yield* new BadRequest({ message: `${role} is not a role of ${registered.name}` })
            }
            if (known.stale && !current.has(role)) {
              return yield* new BadRequest({ message: `${registered.name} no longer has the ${known.name} role` })
            }
          }
          const added = [...wanted].filter((role) => !current.has(role))
          const removed = [...current].filter((role) => !wanted.has(role))
          yield* sql
            .withTransaction(
              Effect.gen(function* () {
                if (Arr.isReadonlyArrayNonEmpty(added)) {
                  yield* sql`
                    INSERT INTO user_roles ${sql.insert(Arr.map(added, (roleId) => ({ userId: user, roleId })))}
                    ON CONFLICT DO NOTHING
                  `
                }
                if (removed.length > 0) {
                  yield* sql`DELETE FROM user_roles WHERE user_id = ${user} AND role_id IN ${sql.in(removed)}`
                }
              }),
            )
            .pipe(Effect.orDie)
        }),
      })
    }),
  )
}
