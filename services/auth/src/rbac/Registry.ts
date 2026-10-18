import { CatalogApp, CatalogPermission, RegisteredApp } from "@mosaik/auth/contract"
import { BadRequest, type ManifestPayload, ownerPermission, ownerRoleId } from "@mosaik/core"
import { Context, Effect, Layer, type Option, Schema } from "effect"
import { SqlClient, SqlSchema } from "effect/sql"

const CatalogRow = Schema.Struct({
  ...CatalogApp.fields,
  permissions: Schema.Array(CatalogPermission),
  registeredAt: Schema.DateTimeUtcFromDate,
})

/**
 * Registry of apps and the permissions they declare.
 *
 * Registration is idempotent and runs every time an app backend starts:
 * - new permissions are created and granted to their `defaultRoles` (only once),
 * - existing permissions get their metadata refreshed,
 * - permissions missing from the manifest are marked stale, never deleted,
 * - the app's roles follow the manifest: their grants change only where they differ (each
 *   change tells apps whose access changed), and roles it no longer declares are marked stale.
 */
/** Why the auth service cannot register a manifest (empty when it can). */
export const manifestProblems = (manifest: ManifestPayload): ReadonlyArray<string> => {
  const problems: Array<string> = []
  const declared = new Set(manifest.permissions.map((p) => p.key))
  const foreign = manifest.permissions.filter((p) => !p.key.startsWith(`${manifest.id}:`))
  if (foreign.length > 0) {
    problems.push(`Permissions must be namespaced with "${manifest.id}:" (${foreign.map((p) => p.key).join(", ")})`)
  }
  if (!declared.has(manifest.access)) problems.push(`The access permission ${manifest.access} is not declared`)
  const owner = ownerPermission(manifest.id)
  const ownerRole = manifest.roles.find((role) => role.id === ownerRoleId(manifest.id))
  if (!declared.has(owner) || ownerRole === undefined || !ownerRole.grants.includes(owner)) {
    problems.push(`The owner role and permission are missing: rebuild the app with the current SDK`)
  }
  for (const role of manifest.roles) {
    if (!role.id.startsWith(`${manifest.id}:`))
      problems.push(`Role ${role.id} must be namespaced with "${manifest.id}:"`)
    const unknown = role.grants.filter((grant) => !declared.has(grant))
    if (unknown.length > 0) problems.push(`Role ${role.id} grants undeclared permissions (${unknown.join(", ")})`)
    if (role !== ownerRole && role.grants.includes(owner)) problems.push(`Only the owner role may grant ${owner}`)
  }
  return problems
}

/** The grants to add and remove so the roles have exactly the grants the manifest gives them. */
export const grantChanges = (
  roles: ReadonlyArray<{ readonly id: string; readonly grants: ReadonlyArray<string> }>,
  current: ReadonlyArray<{ readonly roleId: string; readonly grantKey: string }>,
) => {
  const added: Array<{ roleId: string; grantKey: string }> = []
  const removed = new Map<string, Array<string>>()
  for (const role of roles) {
    const have = new Set(current.filter((row) => row.roleId === role.id).map((row) => row.grantKey))
    const want = new Set(role.grants)
    for (const grantKey of want) if (!have.has(grantKey)) added.push({ roleId: role.id, grantKey })
    const gone = [...have].filter((grantKey) => !want.has(grantKey))
    if (gone.length > 0) removed.set(role.id, gone)
  }
  return { added, removed: removed as ReadonlyMap<string, ReadonlyArray<string>> }
}

export class Registry extends Context.Service<
  Registry,
  {
    register(manifest: ManifestPayload): Effect.Effect<void, BadRequest>
    /**
     * Forgets an uninstalled app: its permissions, its roles (and who had them) and every grant in its namespace, so an
     * app installed later under the same id starts without them.
     */
    unregister(id: string): Effect.Effect<void>
    readonly catalog: Effect.Effect<ReadonlyArray<CatalogApp>>
    find(id: string): Effect.Effect<Option.Option<RegisteredApp>>
  }
>()("@mosaik/auth-service/Registry") {
  static readonly layer = Layer.effect(
    Registry,
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient

      const listCatalog = SqlSchema.findAll({
        Request: Schema.Void,
        Result: CatalogRow,
        execute: () => sql`
          SELECT d.id, d.name, d.description, d.access, d.registered_at,
            COALESCE(
              json_agg(
                json_build_object('key', p.key, 'description', p.description, 'dangerous', p.dangerous, 'stale', p.stale)
                ORDER BY p.key
              ) FILTER (WHERE p.key IS NOT NULL),
              '[]'
            ) AS permissions
          FROM apps d
          LEFT JOIN permissions p ON p.app_id = d.id
          GROUP BY d.id
          ORDER BY d.name
        `,
      })

      const findApp = SqlSchema.findOneOption({
        Request: Schema.String,
        Result: RegisteredApp,
        execute: (id) => sql`
          SELECT d.id, d.name, d.access,
            COALESCE((
              SELECT json_agg(json_build_object(
                'id', r.id, 'name', r.name, 'description', r.description, 'stale', r.stale,
                'permissions', COALESCE((
                  SELECT json_agg(json_build_object('key', p.key, 'description', p.description) ORDER BY p.key)
                  FROM role_grants g JOIN permissions p ON p.key = g.grant_key
                  WHERE g.role_id = r.id
                ), '[]')
              ) ORDER BY r.stale, r.position)
              FROM roles r WHERE r.app_id = d.id
            ), '[]') AS roles
          FROM apps d WHERE d.id = ${id}
        `,
      })

      const register = Effect.fn("Registry.register")(function* (manifest: ManifestPayload) {
        const problems = manifestProblems(manifest)
        if (problems.length > 0) return yield* new BadRequest({ message: problems.join("; ") })

        const created = yield* sql
          .withTransaction(
            Effect.gen(function* () {
              yield* sql`
              INSERT INTO apps (id, name, description, access)
              VALUES (${manifest.id}, ${manifest.name}, ${manifest.description}, ${manifest.access})
              ON CONFLICT (id) DO UPDATE SET
                name = excluded.name, description = excluded.description,
                access = excluded.access, updated_at = now()
            `
              const existing = yield* sql<{
                key: string
              }>`SELECT key FROM permissions WHERE app_id = ${manifest.id}`
              const known = new Set(existing.map((row) => row.key))
              const fresh = manifest.permissions.filter((p) => !known.has(p.key))

              for (const permission of manifest.permissions) {
                yield* sql`
                INSERT INTO permissions (key, app_id, description, dangerous)
                VALUES (${permission.key}, ${manifest.id}, ${permission.description}, ${permission.dangerous})
                ON CONFLICT (key) DO UPDATE SET
                  description = excluded.description, dangerous = excluded.dangerous, stale = false
              `
              }
              for (const permission of fresh) {
                for (const role of permission.defaultRoles) {
                  yield* sql`
                  INSERT INTO role_grants (role_id, grant_key)
                  SELECT id, ${permission.key} FROM roles WHERE id = ${role}
                  ON CONFLICT DO NOTHING
                `
                }
              }
              const declared = manifest.permissions.map((p) => p.key)
              yield* sql`
              UPDATE permissions SET stale = true
              WHERE app_id = ${manifest.id} AND stale = false
                AND ${declared.length > 0 ? sql`key NOT IN ${sql.in(declared)}` : sql.literal("true")}
            `
              const grantChanges = yield* syncRoles(manifest)
              return { fresh, grantChanges }
            }),
          )
          .pipe(Effect.orDie)

        yield* Effect.logInfo(`Registered app "${manifest.id}"`, {
          permissions: manifest.permissions.length,
          new: created.fresh.map((p) => p.key),
          roles: manifest.roles.length,
          grantChanges: created.grantChanges,
        })
      })

      /** Makes the app's roles what the manifest says; returns how many grants changed. */
      const syncRoles = Effect.fn("Registry.syncRoles")(function* (manifest: ManifestPayload) {
        for (const [position, role] of manifest.roles.entries()) {
          yield* sql`
            INSERT INTO roles (id, name, description, app_id, position)
            VALUES (${role.id}, ${role.name}, ${role.description}, ${manifest.id}, ${position})
            ON CONFLICT (id) DO UPDATE SET
              name = excluded.name, description = excluded.description, position = excluded.position, stale = false
          `
        }
        const ids = manifest.roles.map((role) => role.id)
        const current = yield* sql<{ roleId: string; grantKey: string }>`
          SELECT role_id, grant_key FROM role_grants WHERE role_id IN ${sql.in(ids)}
        `
        const changes = grantChanges(manifest.roles, current)
        if (changes.added.length > 0) {
          yield* sql`INSERT INTO role_grants ${sql.insert(changes.added)} ON CONFLICT DO NOTHING`
        }
        for (const [roleId, keys] of changes.removed) {
          yield* sql`DELETE FROM role_grants WHERE role_id = ${roleId} AND grant_key IN ${sql.in(keys)}`
        }
        yield* sql`
          UPDATE roles SET stale = true
          WHERE app_id = ${manifest.id} AND stale = false AND id NOT IN ${sql.in(ids)}
        `
        return changes.added.length + [...changes.removed.values()].reduce((sum, keys) => sum + keys.length, 0)
      })

      return Registry.of({
        register,
        unregister: Effect.fn("Registry.unregister")(function* (id: string) {
          yield* sql
            .withTransaction(
              Effect.gen(function* () {
                yield* sql`DELETE FROM role_grants WHERE grant_key LIKE ${`${id}:%`}`
                yield* sql`DELETE FROM apps WHERE id = ${id}`
              }),
            )
            .pipe(Effect.orDie)
          yield* Effect.logInfo(`Unregistered app "${id}"`)
        }),
        catalog: listCatalog().pipe(
          Effect.map((rows) => rows.map((row) => new CatalogApp(row))),
          Effect.orDie,
          Effect.withSpan("Registry.catalog"),
        ),
        find: (id) => findApp(id).pipe(Effect.orDie, Effect.withSpan("Registry.find")),
      })
    }),
  )
}
