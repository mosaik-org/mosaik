import { defineApp } from "@mosaik/core"

/**
 * Core's administration: users, roles, the audit log, notification channels and AI clients. The auth
 * service registers it and serves its API; the notifications service checks its
 * notification permissions (see `NotificationsAdmin` in @mosaik/notifications/contract).
 * The Portal shows it as the Administration app.
 */
export const admin = defineApp({
  id: "admin",
  name: "Administration",
  description: "Users, roles, notifications, the audit log and AI clients.",
  access: "access",
  permissions: {
    access: { description: "Open the administration" },
    "users.manage": { description: "Create and delete users, assign roles", dangerous: true },
    "roles.manage": { description: "Create roles and change their permissions", dangerous: true },
    "audit.view": { description: "View the audit log of all apps" },
    "notifications.view": { description: "See Teams/Slack channels, routing and the delivery log" },
    "notifications.manage": {
      description: "Configure Teams/Slack channels and routing, retry deliveries",
      dangerous: true,
    },
  },
  roles: {
    auditor: { name: "Auditor", description: "Reads the audit log", grants: ["audit.view"] },
    "user-admin": {
      name: "User admin",
      description: "Manages users and their roles, answers requests for access",
      grants: ["users.manage"],
    },
    operator: {
      name: "Notifications operator",
      description: "Configures Teams/Slack channels and routing",
      grants: ["notifications.*"],
    },
  },
  backend: false,
})
