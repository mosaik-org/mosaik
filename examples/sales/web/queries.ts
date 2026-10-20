import { createApi } from "@mosaik/sdk/solid"
import { keepPreviousData } from "@tanstack/solid-query"
import { type OrderStatus, type OrdersSearch, SalesApi } from "../api"
import { sales } from "../manifest"

/** The API for the pages: queries keyed by the contract, and calls (see `useAction`). */
export const salesApi = createApi(SalesApi)

/** What Sales' settings allow (exports, the largest refund): changed by its owners while it runs. */
export const optionsQuery = () => salesApi.orders.options.query({})

export const summaryQuery = (days: number) => salesApi.stats.summary.query({ query: { days } })

// While the next page loads, the table keeps the current one.
export const ordersQuery = (search: OrdersSearch) => ({
  ...salesApi.orders.list.query({ query: search }),
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
