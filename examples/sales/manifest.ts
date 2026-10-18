import { defineApp } from "@mosaik/sdk"

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
  database: true,
  portal: {
    icon: "chart-line",
    category: "Sales",
  },
})

export default sales
