import { AppsAdmin } from "@mosaik/portal/contract"
import { AppLayout } from "@mosaik/web-kit"
import { createFileRoute } from "@tanstack/solid-router"
import { admin } from "../../manifest"

export const Route = createFileRoute("/_app/admin")({
  component: () => (
    <AppLayout
      app={admin}
      nav={[
        { to: "/admin/users", label: "Users", permission: admin.perm("users.manage") },
        { to: "/admin/roles", label: "Roles & permissions" },
        { to: "/admin/apps", label: "Apps", permission: AppsAdmin.manage },
        { to: "/admin/usage", label: "Usage", permission: AppsAdmin.manage },
        { to: "/admin/notifications", label: "Notifications", permission: admin.perm("notifications.view") },
        { to: "/admin/deliveries", label: "Deliveries", permission: admin.perm("notifications.view") },
        { to: "/admin/audit", label: "Audit log", permission: admin.perm("audit.view") },
      ]}
    />
  ),
})
