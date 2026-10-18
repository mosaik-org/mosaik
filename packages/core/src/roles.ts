import { Schema } from "effect"
import { grantCovers, PermissionKey } from "./permission"

/** Roles that always exist and cannot be deleted. */
export const BuiltInRoles = {
  /** Applies to every request, including visitors that are not logged in. */
  anonymous: "anonymous",
  /** Applies to every logged-in user. */
  authenticated: "authenticated",
  /** Holds the `*` grant. */
  superadmin: "superadmin",
} as const

export type BuiltInRoleId = (typeof BuiltInRoles)[keyof typeof BuiltInRoles]

/** Roles admins create (and the built-in ones): `sales-managers`. */
export const CustomRoleId = Schema.String.check(
  Schema.isPattern(/^[a-z][a-z0-9-]{1,47}$/, { message: "Lowercase letters, digits and dashes" }),
)

/** Any role: a custom or built-in one (`sales-managers`), or an app's own (`sales:editor`). */
export const RoleId = Schema.String.check(
  Schema.isPattern(/^(?:[a-z][a-z0-9-]*:)?[a-z][a-z0-9-]{1,47}$/, {
    message: "Lowercase letters, digits and dashes, optionally after the app id (`sales:editor`)",
  }),
)

/** Names of the roles an app declares (`editor`), unique within the app. */
export const RoleNamePattern = /^[a-z][a-z0-9-]{1,30}$/

/**
 * Every app's permission to decide who can use it: its owners assign the app's roles and
 * answer requests for access. Added by the platform; apps cannot declare it.
 */
export const OWNER_PERMISSION_NAME = "access.manage"

/** The role every app gets for its owners. */
export const OWNER_ROLE_NAME = "owner"

/** The role an app gets when it declares none. */
export const MEMBER_ROLE_NAME = "member"

export const ownerPermission = <Id extends string>(app: Id): PermissionKey<Id, typeof OWNER_PERMISSION_NAME> =>
  `${app}:${OWNER_PERMISSION_NAME}`

export const appRoleId = (app: string, name: string): string => `${app}:${name}`

export const ownerRoleId = (app: string): string => appRoleId(app, OWNER_ROLE_NAME)

/** The app a role belongs to; `undefined` for custom and built-in roles. */
export const appOfRole = (role: string): string | undefined => {
  const separator = role.indexOf(":")
  return separator === -1 ? undefined : role.slice(0, separator)
}

/**
 * A role an app declares in its manifest, e.g. `editor: { name: "Editor", grants: ["orders.*"] }`.
 * Every app role includes the app's access permission.
 */
export interface RoleSpec<Name extends string> {
  readonly name: string
  readonly description?: string
  /** The app's own permissions, on top of its access permission. Wildcards (`orders.*`, `*`) cover them too. */
  readonly grants?: ReadonlyArray<Name | "*" | `${string}.*`>
}

/** An app role as the platform stores it. Its grants are concrete permissions, never wildcards. */
export class ManifestRole extends Schema.Class<ManifestRole>("@mosaik/core/ManifestRole")({
  id: RoleId,
  name: Schema.String,
  description: Schema.NullOr(Schema.String),
  grants: Schema.Array(PermissionKey),
}) {}

/**
 * The app's permissions a role's grants cover. Wildcards are expanded when the app
 * registers, so a role gains the permissions an app adds in its next version, and an app
 * role can never reach the owner permission (which no manifest declares).
 */
export const expandRoleGrants = (
  app: string,
  permissions: ReadonlyArray<string>,
  grants: ReadonlyArray<string>,
): ReadonlyArray<PermissionKey> => {
  const keys = new Set<PermissionKey>()
  for (const grant of grants) {
    const covered = permissions.filter((name) => grantCovers(`${app}:${grant}`, `${app}:${name}`))
    if (covered.length === 0) throw new Error(`Role grant "${grant}" covers no permission of app "${app}"`)
    for (const name of covered) keys.add(`${app}:${name}`)
  }
  return [...keys].sort()
}
