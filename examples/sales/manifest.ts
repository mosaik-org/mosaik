import { defineApp, Setting } from "@mosaik/sdk"

export const sales = defineApp({
  id: "sales",
  name: "Sales",
  description: "Revenue, orders and refunds.",
  access: "view",
  permissions: {
    view: { description: "View revenue and orders", defaultRoles: ["authenticated"] },
    "orders.edit": { description: "Change the status of orders" },
    "orders.refund": { description: "Refund orders", dangerous: true },
    "orders.export": { description: "Export orders as CSV" },
  },
  roles: {
    analyst: { name: "Analyst", description: "Exports orders for reporting", grants: ["orders.export"] },
    "order-manager": {
      name: "Order manager",
      description: "Changes and exports orders",
      grants: ["orders.edit", "orders.export"],
    },
    refunds: { name: "Refunds", description: "Everything order managers do, and refunds", grants: ["orders.*"] },
  },
  notifications: {
    "order.refunded": { description: "An order was refunded", defaultChannels: ["inApp"] },
  },
  // Changed by Sales' owners in its management page; the backend reads them while it runs.
  settings: {
    refundLimit: Setting.number({
      label: "Largest refund",
      description: "Larger refunds are refused here: finance handles them.",
      unit: "EUR",
      min: 0,
      default: 500,
    }),
    exportsEnabled: Setting.boolean({
      label: "Allow CSV exports",
      description: "When off, nobody exports orders, whatever their role.",
      default: true,
    }),
  },
  database: true,
  // Files attached to orders (see `Storage` in the backend), within the limit admins give Sales.
  storage: true,
  // Beside Orders in Mosaik's navigation (see server/pending.ts).
  statuses: {
    "orders.pending": { description: "Orders waiting for approval", kind: "count", page: "/orders" },
  },
  portal: {
    icon: "chart-line",
    color: "teal",
    category: "Sales",
    // Listed under Sales in the shell's sidebar while it is open.
    pages: [
      { title: "Overview", path: "/" },
      { title: "Orders", path: "/orders" },
    ],
  },
})

export default sales
