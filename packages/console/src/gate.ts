import { admin } from "@mosaik/auth/contract"
import type { Principal } from "@mosaik/core"
import { managesAnyApp } from "./access/queries"

/** Who may open the console: admins, and the owners of an app (for the apps they own). */
export const canUseConsole = (principal: Principal): boolean =>
  principal.can(admin.accessPermission) || managesAnyApp(principal)

export interface ConsoleNavItem {
  readonly to: "/admin" | "/manage" | "/access-requests"
  readonly label: string
}

/** The console's sections the principal may use, for a host's navigation. */
export const consoleNav = (principal: Principal): ReadonlyArray<ConsoleNavItem> => [
  ...(principal.can(admin.accessPermission) ? [{ to: "/admin", label: "Administration" } as const] : []),
  ...(managesAnyApp(principal)
    ? [{ to: "/manage", label: "Apps" } as const, { to: "/access-requests", label: "Access requests" } as const]
    : []),
]
