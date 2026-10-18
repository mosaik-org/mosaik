import { Schema } from "effect"

/**
 * Permissions are flat, namespaced keys: `<appId>:<name>`, e.g. `sales:orders.refund`.
 *
 * Grants (what roles hold) may additionally end in a wildcard:
 * - `*`               every permission of every app
 * - `sales:*`         every permission of the `sales` app
 * - `sales:orders.*`  every `orders.` permission of `sales`
 */
const SEGMENT = "[a-z][a-z0-9-]*"
const NAME = `${SEGMENT}(?:\\.${SEGMENT})*`

export const AppIdPattern = new RegExp(`^${SEGMENT}$`)
export const PermissionNamePattern = new RegExp(`^${NAME}$`)
export const PermissionKeyPattern = new RegExp(`^${SEGMENT}:${NAME}$`)
export const GrantPattern = new RegExp(`^(?:\\*|${SEGMENT}:(?:\\*|${NAME}(?:\\.\\*)?))$`)

export type PermissionKey<Id extends string = string, Name extends string = string> = `${Id}:${Name}`

export const PermissionKey = Schema.TemplateLiteral([Schema.String, ":", Schema.String]).check(
  Schema.isPattern(PermissionKeyPattern, { message: "Expected a permission key like `sales:orders.edit`" }),
)

export const Grant = Schema.String.check(
  Schema.isPattern(GrantPattern, { message: "Expected a permission key or wildcard like `sales:*`" }),
)

export const WILDCARD = "*"

/** Whether a single grant covers the given permission. */
export const grantCovers = (grant: string, permission: string): boolean => {
  if (grant === permission || grant === WILDCARD) return true
  return grant.endsWith(".*") || grant.endsWith(":*") ? permission.startsWith(grant.slice(0, -1)) : false
}

/** Whether any of the grants covers the given permission. */
export const isGranted = (grants: Iterable<string>, permission: string): boolean => {
  for (const grant of grants) {
    if (grantCovers(grant, permission)) return true
  }
  return false
}

export const appOf = (permission: PermissionKey): string => permission.slice(0, permission.indexOf(":"))

/**
 * The grants that matter inside one namespace (an app): `*` and the namespace's own
 * grants. Tokens for an app carry only these, so an app learns nothing about the
 * rest of the principal's access.
 */
export const scopeGrants = (grants: ReadonlyArray<string>, namespace: string): ReadonlyArray<string> =>
  grants.filter((grant) => grant === WILDCARD || grant.startsWith(`${namespace}:`))

/**
 * The apps (namespaces) where the grants give the permission `name`, e.g. the apps someone
 * owns for `access.manage`; `"all"` when a grant covers every app (`*`).
 */
export const namespacesGranting = (grants: Iterable<string>, name: string): "all" | ReadonlySet<string> => {
  const namespaces = new Set<string>()
  for (const grant of grants) {
    if (grant === WILDCARD) return "all"
    const namespace = grant.slice(0, grant.indexOf(":"))
    if (grantCovers(grant, `${namespace}:${name}`)) namespaces.add(namespace)
  }
  return namespaces
}
