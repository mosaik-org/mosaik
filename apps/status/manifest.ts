import { defineApp } from "@mosaik/core"

export const status = defineApp({
  id: "status",
  name: "Platform status",
  description: "Live health of the platform's services.",
  access: "view",
  permissions: {
    // Public by default: the anonymous role gets `status:view` on first registration.
    view: { description: "See the status of services", defaultRoles: ["anonymous"] },
    // No default roles: superadmins get the alerts; grant it to whoever is on call.
    alerts: { description: "Get notified when a service goes down or recovers" },
  },
  roles: {
    viewer: { name: "Viewer", description: "Sees the status of services" },
    "on-call": { name: "On call", description: "Is notified when a service goes down", grants: ["alerts"] },
  },
  notifications: {
    // Open while the service is down: its recovery resolves it, so nobody looks into it after the fact.
    "service.down": {
      description: "A platform service went down or recovered",
      defaultChannels: ["inApp", "email"],
      action: true,
      resolvedBy: "app",
    },
  },
  portal: {
    icon: "activity",
    category: "Operations",
  },
})

export default status
