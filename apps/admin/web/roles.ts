import type { Role } from "@mosaik/auth/contract"

/** A role as people read it: `Sales · Order manager` for an app's own. */
export const roleLabel = (role: Role): string => (role.appName === null ? role.name : `${role.appName} · ${role.name}`)

export interface AppRoles {
  readonly id: string
  readonly name: string
  readonly roles: ReadonlyArray<Role>
}

/** Apps' own roles by app, in the order they come (by app name, then as the app declares them). */
export const groupAppRoles = (roles: ReadonlyArray<Role>): ReadonlyArray<AppRoles> => {
  const apps = new Map<string, { id: string; name: string; roles: Array<Role> }>()
  for (const role of roles) {
    if (role.app === null) continue
    const app = apps.get(role.app) ?? {
      id: role.app,
      name: role.appName ?? role.app,
      roles: [],
    }
    app.roles.push(role)
    apps.set(role.app, app)
  }
  return [...apps.values()]
}
