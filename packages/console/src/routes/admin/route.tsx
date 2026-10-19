import { admin } from "@mosaik/auth/contract"
import { AppLayout } from "@mosaik/web-kit"
import { createFileRoute } from "@tanstack/solid-router"

/** Core's administration: users, roles, notification channels and the audit log. */
export const Route = createFileRoute("/_app/admin")({
  component: () => (
    <AppLayout
      app={admin}
      icon="shield"
      nav={[
        { to: "/admin/users", label: "Users", permission: admin.perm("users.manage") },
        { to: "/admin/roles", label: "Roles & permissions" },
        { to: "/admin/notifications", label: "Notifications", permission: admin.perm("notifications.view") },
        { to: "/admin/deliveries", label: "Deliveries", permission: admin.perm("notifications.view") },
        { to: "/admin/audit", label: "Audit log", permission: admin.perm("audit.view") },
      ]}
    />
  ),
})
