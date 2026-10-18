import { type CreateRole, Role, type UpdateRole } from "@mosaik/auth/contract"
import { BadRequest, BuiltInRoles, Conflict, NotFound } from "@mosaik/core"
import { Context, Effect, Layer, Schema } from "effect"
import { SqlClient, SqlSchema, type Statement } from "effect/sql"

/**
 * Role management: CRUD plus the permission grants attached to each role. Apps' roles
 * (`sales:editor`) follow their manifests: they cannot be changed here, only deleted
 * once the app no longer declares them.
 */
export class Roles extends Context.Service<
  Roles,
  {
    readonly list: Effect.Effect<ReadonlyArray<Role>>
    get(id: string): Effect.Effect<Role, NotFound>
    create(input: CreateRole): Effect.Effect<Role, Conflict>
    update(id: string, input: UpdateRole): Effect.Effect<Role, NotFound | BadRequest>
    setGrants(id: string, grants: ReadonlyArray<string>): Effect.Effect<Role, NotFound | BadRequest>
    delete(id: string): Effect.Effect<void, NotFound | BadRequest>
  }
>()("@mosaik/auth-service/Roles") {
  static readonly layer = Layer.effect(
    Roles,
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient

      const select = (where: Statement.Fragment) => sql`
        SELECT r.id, r.name, r.description, r.built_in, r.app_id AS app, d.name AS app_name, r.stale,
          COALESCE(array_agg(g.grant_key ORDER BY g.grant_key) FILTER (WHERE g.grant_key IS NOT NULL), '{}') AS grants,
          (SELECT count(*)::int FROM user_roles ur WHERE ur.role_id = r.id) AS user_count
        FROM roles r
        LEFT JOIN apps d ON d.id = r.app_id
        LEFT JOIN role_grants g ON g.role_id = r.id
        WHERE ${where}
        GROUP BY r.id, d.name
        ORDER BY r.built_in DESC, r.app_id IS NOT NULL, d.name, r.stale, r.position, r.name
      `

      const findAll = SqlSchema.findAll({
        Request: Schema.Void,
        Result: Role,
        execute: () => select(sql.literal("true")),
      })
      const findById = SqlSchema.findOneOption({
        Request: Schema.String,
        Result: Role,
        execute: (id) => select(sql`r.id = ${id}`),
      })

      const get = Effect.fn("Roles.get")(function* (id: string) {
        const role = yield* findById(id).pipe(Effect.orDie)
        if (role._tag === "None") return yield* new NotFound({ resource: "role", id })
        return role.value
      })

      /** Roles admins can change: not the ones apps declare. */
      const editable = Effect.fn(function* (id: string) {
        const role = yield* get(id)
        if (role.app !== null) {
          return yield* new BadRequest({ message: `${role.appName} defines this role: change it in the app` })
        }
        return role
      })

      return Roles.of({
        list: findAll().pipe(Effect.orDie, Effect.withSpan("Roles.list")),

        get,

        create: Effect.fn("Roles.create")(function* (input: CreateRole) {
          const inserted = yield* sql`
            INSERT INTO roles (id, name, description) VALUES (${input.id}, ${input.name}, ${input.description})
            ON CONFLICT (id) DO NOTHING
            RETURNING id
          `.pipe(Effect.orDie)
          if (inserted.length === 0) return yield* new Conflict({ message: `Role "${input.id}" already exists` })
          return yield* get(input.id).pipe(Effect.orDie)
        }),

        update: Effect.fn("Roles.update")(function* (id: string, input: UpdateRole) {
          yield* editable(id)
          const updated = yield* sql`
            UPDATE roles SET name = ${input.name}, description = ${input.description} WHERE id = ${id} RETURNING id
          `.pipe(Effect.orDie)
          if (updated.length === 0) return yield* new NotFound({ resource: "role", id })
          return yield* get(id)
        }),

        setGrants: Effect.fn("Roles.setGrants")(function* (id: string, grants: ReadonlyArray<string>) {
          if (id === BuiltInRoles.superadmin) {
            return yield* new BadRequest({ message: "The superadmin role always has every permission" })
          }
          yield* editable(id)
          const unique = [...new Set(grants)]
          yield* sql
            .withTransaction(
              Effect.gen(function* () {
                yield* sql`DELETE FROM role_grants WHERE role_id = ${id}`
                if (unique.length > 0) {
                  yield* sql`INSERT INTO role_grants ${sql.insert(unique.map((grantKey) => ({ roleId: id, grantKey })))}`
                }
              }),
            )
            .pipe(Effect.orDie)
          return yield* get(id)
        }),

        delete: Effect.fn("Roles.delete")(function* (id: string) {
          const role = yield* get(id)
          if (role.builtIn) return yield* new BadRequest({ message: "Built-in roles cannot be deleted" })
          if (role.app !== null && !role.stale) {
            return yield* new BadRequest({
              message: `${role.appName} defines this role: it can be deleted once the app no longer does`,
            })
          }
          yield* sql`DELETE FROM roles WHERE id = ${id}`.pipe(Effect.orDie)
        }),
      })
    }),
  )
}
