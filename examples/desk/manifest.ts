import { defineApp, Setting } from "@mosaik/sdk"

export const desk = defineApp({
  id: "desk",
  name: "Service Desk",
  description: "Ask IT, HR or Finance for help, and follow your requests.",
  access: "use",
  permissions: {
    use: { description: "Send requests and follow your own", defaultRoles: ["authenticated"] },
    "requests.work": { description: "Work on everyone's requests" },
    "requests.delete": { description: "Delete requests", dangerous: true },
    configure: { description: "Change queues, deadlines and saved replies" },
  },
  roles: {
    agent: { name: "Agent", description: "Works on requests", grants: ["requests.work"] },
    lead: {
      name: "Lead",
      description: "Everything agents do, deletes requests and sets up the desk",
      grants: ["requests.*", "configure"],
    },
  },
  notifications: {
    "request.assigned": { description: "A request was assigned to you", defaultChannels: ["inApp"] },
    "request.replied": { description: "Someone replied to a request of yours", defaultChannels: ["inApp"] },
    "request.overdue": { description: "A request you handle missed its deadline", defaultChannels: ["inApp"] },
  },
  events: ["user.created", "user.deleted", "user.access_changed"],
  settings: {
    closeAfterDays: Setting.number({
      label: "Close solved requests after",
      description: "Until then, a reply reopens a solved request. After that, people send a new one.",
      unit: "days",
      min: 1,
      default: 7,
    }),
  },
  database: true,
  // Files attached to requests (see `Storage` in the backend), within the limit admins give the desk.
  storage: true,
  // Shown beside its pages in Mosaik's navigation (see server/statuses.ts).
  statuses: {
    inbox: { description: "Requests waiting for you", kind: "count", page: "/" },
    // The app's rather than a page's: red beside the app in the sidebar, and no second red in its tabs.
    overdue: { description: "Requests past their deadline", kind: "count", tone: "danger" },
    mine: { description: "Your requests waiting for your answer", kind: "count", page: "/mine" },
  },
  portal: {
    icon: "life-buoy",
    color: "violet",
    category: "Support",
    pages: [
      { title: "Inbox", path: "/", permission: "requests.work" },
      { title: "All requests", path: "/all", permission: "requests.work" },
      { title: "My requests", path: "/mine" },
      { title: "Setup", path: "/setup", permission: "configure" },
    ],
  },
})

export default desk
