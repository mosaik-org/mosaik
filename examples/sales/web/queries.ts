import { makeApiClient } from "@mosaik/sdk/client"
import { keepPreviousData, queryOptions } from "@tanstack/solid-query"
import { type OrderStatus, type OrdersSearch, SalesApi } from "../api"
import { sales } from "../manifest"

export const salesApi = makeApiClient(SalesApi)

export const salesKeys = {
  all: [sales.id] as const,
  summary: (days: number) => [sales.id, "summary", days] as const,
  orders: (search: OrdersSearch) => [sales.id, "orders", search] as const,
}

export const summaryQuery = (days: number) =>
  queryOptions({
    queryKey: salesKeys.summary(days),
    queryFn: () => salesApi((client) => client.stats.summary({ query: { days } })),
  })

export const ordersQuery = (search: OrdersSearch) =>
  queryOptions({
    queryKey: salesKeys.orders(search),
    queryFn: () => salesApi((client) => client.orders.list({ query: search })),
    placeholderData: keepPreviousData,
  })

/** CSV downloads are plain links: the browser sends the session cookie, the gateway adds the token. */
export const exportUrl = (filter: { status?: OrderStatus | undefined; search?: string | undefined }): string => {
  const params = new URLSearchParams()
  if (filter.status) params.set("status", filter.status)
  if (filter.search) params.set("search", filter.search)
  const query = params.toString()
  return `${sales.apiPrefix}/orders/export.csv${query ? `?${query}` : ""}`
}
