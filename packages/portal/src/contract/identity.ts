import { defineApp } from "@mosaik/core"

/**
 * The Portal's permissions, registered with Core when the Portal service starts (like an
 * app's manifest), so admins give them in roles like any app's.
 */
export const portalApp = defineApp({
  id: "portal",
  name: "Portal",
  description: "The shell, the app directory, and installing and running apps.",
  access: "use",
  permissions: {
    use: { description: "Use the Portal", defaultRoles: ["authenticated"] },
    "apps.manage": { description: "Install, update and remove apps", dangerous: true },
  },
  roles: {
    operator: { name: "App operator", description: "Installs and runs apps", grants: ["apps.*"] },
  },
})

/** Admin permission for installing and running apps. */
export const AppsAdmin = { manage: portalApp.perm("apps.manage") }
