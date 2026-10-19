import { defineApp } from "@mosaik/core"

/**
 * The Portal's permissions, registered with Core when the Portal service starts (like an
 * app's manifest), so admins give them in roles like any app's. The shell lists its pages
 * (`apps/portal`) as an app for the people who hold them.
 */
export const portalApp = defineApp({
  id: "portal",
  name: "Portal",
  description: "Installing and running apps, and how much they are used.",
  // Its pages are for operators: everyone else uses the Portal without a permission of its own.
  access: "apps.manage",
  permissions: {
    "apps.manage": { description: "Install, update and remove apps", dangerous: true },
  },
  roles: {
    operator: { name: "App operator", description: "Installs and runs apps", grants: ["apps.*"] },
  },
})

/** Admin permission for installing and running apps. */
export const AppsAdmin = { manage: portalApp.perm("apps.manage") }
