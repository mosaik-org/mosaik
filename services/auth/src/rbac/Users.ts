import { AdminUser, type CreateUser } from "@mosaik/auth/contract"
import { BadRequest, BuiltInRoles, type Conflict, NotFound, PrincipalUser, UserId } from "@mosaik/core"
import { Context, Effect, Layer, Redacted, Schema } from "effect"
import { SqlClient, SqlSchema, type Statement } from "effect/sql"
import { BetterAuth } from "../BetterAuth"

const UserRow = Schema.Struct({ ...AdminUser.fields, createdAt: Schema.DateTimeUtcFromDate })

/** Roles that are implicit and therefore never assigned to users explicitly. */
const IMPLICIT_ROLES = new Set<string>([BuiltInRoles.anonymous, BuiltInRoles.authenticated])

/**
 * User management on top of Better Auth's user table plus our `user_roles`.
 * Guards against locking everyone out (the last superadmin cannot be removed).
 */
export class Users extends Context.Service<
  Users,
  {
    readonly list: Effect.Effect<ReadonlyArray<AdminUser>>
    get(id: UserId): Effect.Effect<AdminUser, NotFound>
    /** Contact details of the given users; unknown ids are left out. */
    lookup(ids: ReadonlyArray<UserId>): Effect.Effect<ReadonlyArray<PrincipalUser>>
    /** Users whose name or e-mail contains `query` (at most 20). */
    search(query: string): Effect.Effect<ReadonlyArray<PrincipalUser>>
    create(input: CreateUser): Effect.Effect<AdminUser, Conflict | BadRequest>
    setRoles(id: UserId, roles: ReadonlyArray<string>): Effect.Effect<AdminUser, NotFound | BadRequest>
    delete(id: UserId, actor: UserId | null): Effect.Effect<void, NotFound | BadRequest>
    /** Ensures the bootstrap admin exists and is a superadmin. Idempotent. */
    ensureSuperadmin(email: string, password: Redacted.Redacted<string>): Effect.Effect<void>
  }
>()("@mosaik/auth-service/Users") {
  static readonly layer = Layer.effect(
    Users,
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient
      const auth = yield* BetterAuth

      const select = (where: Statement.Fragment) => sql`
        SELECT u.id, u.email, u.name, u.image, u."createdAt" AS created_at,
          COALESCE((SELECT array_agg(ur.role_id ORDER BY ur.role_id) FROM user_roles ur WHERE ur.user_id = u.id), '{}') AS roles,
          COALESCE((SELECT array_agg(DISTINCT a."providerId") FROM account a WHERE a."userId" = u.id), '{}') AS providers
        FROM "user" u
        WHERE ${where}
        ORDER BY lower(u.name)
      `
      const decode = (row: typeof UserRow.Type) => new AdminUser(row)
      const findAll = SqlSchema.findAll({
        Request: Schema.Void,
        Result: UserRow,
        execute: () => select(sql.literal("true")),
      })
      const findById = SqlSchema.findOneOption({
        Request: Schema.String,
        Result: UserRow,
        execute: (id) => select(sql`u.id = ${id}`),
      })
      const findContacts = SqlSchema.findAll({
        Request: Schema.Array(Schema.String),
        Result: PrincipalUser,
        execute: (ids) => sql`SELECT id, email, name, image FROM "user" WHERE id IN ${sql.in(ids)}`,
      })
      const findMatching = SqlSchema.findAll({
        Request: Schema.String,
        Result: PrincipalUser,
        execute: (pattern) => sql`
          SELECT id, email, name, image FROM "user"
          WHERE name ILIKE ${pattern} OR email ILIKE ${pattern}
          ORDER BY lower(name)
          LIMIT 20
        `,
      })
      const findIdByEmail = SqlSchema.findOneOption({
        Request: Schema.String,
        Result: Schema.Struct({ id: UserId }),
        execute: (email) => sql`SELECT id FROM "user" WHERE lower(email) = lower(${email})`,
      })

      const get = Effect.fn("Users.get")(function* (id: UserId) {
        const row = yield* findById(id).pipe(Effect.orDie)
        if (row._tag === "None") return yield* new NotFound({ resource: "user", id })
        return decode(row.value)
      })

      const otherSuperadmins = (id: UserId) =>
        sql<{ count: number }>`
          SELECT count(*)::int AS count FROM user_roles WHERE role_id = ${BuiltInRoles.superadmin} AND user_id <> ${id}
        `.pipe(
          Effect.map(([row]) => row?.count ?? 0),
          Effect.orDie,
        )

      const validateRoles = Effect.fn(function* (roles: ReadonlyArray<string>) {
        const unique = [...new Set(roles)]
        const implicit = unique.filter((role) => IMPLICIT_ROLES.has(role))
        if (implicit.length > 0) {
          return yield* new BadRequest({ message: `Roles ${implicit.join(", ")} apply automatically` })
        }
        if (unique.length === 0) return unique
        const existing = yield* sql<{ id: string }>`SELECT id FROM roles WHERE id IN ${sql.in(unique)}`.pipe(
          Effect.orDie,
        )
        const missing = unique.filter((role) => !existing.some((row) => row.id === role))
        if (missing.length > 0) return yield* new BadRequest({ message: `Unknown roles: ${missing.join(", ")}` })
        return unique
      })

      const writeRoles = (id: UserId, roles: ReadonlyArray<string>) =>
        sql
          .withTransaction(
            Effect.gen(function* () {
              yield* sql`DELETE FROM user_roles WHERE user_id = ${id}`
              if (roles.length > 0) {
                yield* sql`INSERT INTO user_roles ${sql.insert(roles.map((roleId) => ({ userId: id, roleId })))}`
              }
            }),
          )
          .pipe(Effect.orDie)

      const setRoles = Effect.fn("Users.setRoles")(function* (id: UserId, roles: ReadonlyArray<string>) {
        const user = yield* get(id)
        const next = yield* validateRoles(roles)
        const losesSuperadmin = user.roles.includes(BuiltInRoles.superadmin) && !next.includes(BuiltInRoles.superadmin)
        if (losesSuperadmin && (yield* otherSuperadmins(id)) === 0) {
          return yield* new BadRequest({ message: "At least one superadmin must remain" })
        }
        yield* writeRoles(id, next)
        return yield* get(id)
      })

      return Users.of({
        list: findAll().pipe(
          Effect.map((rows) => rows.map(decode)),
          Effect.orDie,
          Effect.withSpan("Users.list"),
        ),

        get,

        lookup: Effect.fn("Users.lookup")(function* (ids: ReadonlyArray<UserId>) {
          if (ids.length === 0) return []
          return yield* findContacts([...new Set(ids)]).pipe(Effect.orDie)
        }),

        search: (query) =>
          findMatching(`%${query.trim().replace(/[\\%_]/g, (char) => `\\${char}`)}%`).pipe(
            Effect.orDie,
            Effect.withSpan("Users.search"),
          ),

        create: Effect.fn("Users.create")(function* (input: CreateUser) {
          const roles = yield* validateRoles(input.roles)
          const id = yield* auth
            .createPasswordUser({ email: input.email, name: input.name, password: Redacted.make(input.password) })
            .pipe(Effect.catchTag("AuthBackendError", Effect.die))
          yield* writeRoles(id, roles)
          return yield* get(id).pipe(Effect.orDie)
        }),

        setRoles,

        delete: Effect.fn("Users.delete")(function* (id: UserId, actor: UserId | null) {
          if (id === actor) return yield* new BadRequest({ message: "You cannot delete your own account" })
          const user = yield* get(id)
          if (user.roles.includes(BuiltInRoles.superadmin) && (yield* otherSuperadmins(id)) === 0) {
            return yield* new BadRequest({ message: "At least one superadmin must remain" })
          }
          yield* auth.deleteUser(id).pipe(Effect.orDie)
        }),

        ensureSuperadmin: Effect.fn("Users.ensureSuperadmin")(function* (email, password) {
          const existing = yield* findIdByEmail(email).pipe(Effect.orDie)
          const id =
            existing._tag === "Some"
              ? existing.value.id
              : yield* auth.createPasswordUser({ email, name: "Administrator", password }).pipe(Effect.orDie)
          yield* sql`
            INSERT INTO user_roles (user_id, role_id) VALUES (${id}, ${BuiltInRoles.superadmin})
            ON CONFLICT DO NOTHING
          `.pipe(Effect.orDie)
          if (existing._tag === "None") yield* Effect.logInfo(`Created bootstrap superadmin ${email}`)
        }),
      })
    }),
  )
}
