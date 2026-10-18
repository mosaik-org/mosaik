import { formatCurrency } from "@mosaik/sdk/client"
import { defineSearchProvider } from "@mosaik/sdk/portal"
import { sales } from "../manifest"
import { salesApi } from "./queries"

/** Finds orders by number or customer from the command palette. */
export default defineSearchProvider({
  id: "sales-orders",
  group: "Orders",
  permission: sales.accessPermission,
  search: async (query) => {
    const page = await salesApi((client) => client.orders.list({ query: { search: query, pageSize: 5 } }))
    return page.rows.map((order) => ({
      id: String(order.id),
      title: `${order.number} · ${order.customer}`,
      subtitle: `${formatCurrency(order.amountCents)} · ${order.status}`,
      to: `/sales/orders?search=${encodeURIComponent(order.number)}`,
    }))
  },
})
