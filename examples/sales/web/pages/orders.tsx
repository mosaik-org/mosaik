import { Button, Input, SelectField } from "@mosaik/mosaik-ui"
import { formatCurrency, formatDateTime } from "@mosaik/sdk/client"
import { css } from "@mosaik/sdk/css"
import { useCommands, useSearchParams, useTableSearch } from "@mosaik/sdk/portal"
import { Can, createDebounced, useCan } from "@mosaik/sdk/solid"
import { createColumnHelper, DataTable } from "@mosaik/sdk/table"
import { QueryFreshness } from "@mosaik/sdk/ui"
import { useQuery } from "@tanstack/solid-query"
import Download from "lucide-solid/icons/download"
import { createEffect, createSignal, on } from "solid-js"
import { ORDERS_DEFAULTS, type Order, OrderSortField, OrderStatus, OrdersSearch } from "../../api"
import { sales } from "../../manifest"
import { OrderActions } from "../components/OrderActions"
import { StatusBadge } from "../components/StatusBadge"
import { exportUrl, ordersQuery } from "../queries"

const column = createColumnHelper<Order>()

const columns = column.columns([
  column.accessor("number", {
    header: "Order",
    cell: (info) => <span class={css({ fontFamily: "mono" })}>{info.getValue()}</span>,
  }),
  column.accessor("customer", { header: "Customer" }),
  column.accessor("region", { header: "Region", enableSorting: false }),
  column.accessor("status", {
    header: "Status",
    enableSorting: false,
    cell: (info) => <StatusBadge status={info.getValue()} />,
  }),
  column.accessor("amountCents", {
    header: "Amount",
    meta: { align: "right" },
    cell: (info) => formatCurrency(info.getValue()),
  }),
  column.accessor("createdAt", { header: "Created", cell: (info) => formatDateTime(info.getValue()) }),
  column.display({
    id: "actions",
    header: "",
    meta: { align: "right", width: "56px" },
    cell: (info) => <OrderActions order={info.row.original} />,
  }),
])

const STATUS_FILTERS = [
  { value: "all", label: "All statuses" },
  ...OrderStatus.literals.map((status) => ({ value: status, label: status[0]?.toUpperCase() + status.slice(1) })),
]

/** Every order, searchable and filterable, with the actions the user's permissions allow. */
export default function Orders() {
  const [search, setSearch] = useSearchParams(OrdersSearch)
  const table = useTableSearch({
    search,
    navigate: (update, { replace }) => setSearch(update, { replace }),
    defaults: ORDERS_DEFAULTS,
    sortable: OrderSortField.literals,
  })
  const orders = useQuery(() => ordersQuery(table.params()))
  const can = useCan()

  useCommands(() => [
    ...STATUS_FILTERS.map((filter) => ({
      id: `sales:orders:filter:${filter.value}`,
      title: filter.value === "all" ? "Show all orders" : `Show ${filter.label.toLowerCase()} orders`,
      group: "Orders",
      keywords: ["filter", "status"],
      perform: () => table.setFilters({ status: filter.value === "all" ? undefined : (filter.value as OrderStatus) }),
    })),
    ...(can(sales.perm("orders.export"))
      ? [
          {
            id: "sales:orders:export",
            title: "Export orders as CSV",
            group: "Orders",
            keywords: ["download", "csv"],
            icon: <Download size={16} />,
            perform: () => window.location.assign(exportUrl(table.params())),
          },
        ]
      : []),
  ])

  // Typing updates the URL once the user pauses.
  const [text, setText] = createSignal(table.params().search ?? "")
  const debouncedText = createDebounced(text, 300)
  createEffect(
    on(debouncedText, (value) => table.setFilters({ search: value.trim() || undefined }, { replace: true }), {
      defer: true,
    }),
  )
  // The URL can also change from outside (back button, command palette).
  createEffect(
    on(
      () => table.params().search,
      (value) => {
        if ((value ?? "") !== debouncedText().trim()) setText(value ?? "")
      },
      { defer: true },
    ),
  )

  return (
    <div class={css({ display: "flex", flexDirection: "column", gap: "4" })}>
      <div class={css({ display: "flex", gap: "3", flexWrap: "wrap", alignItems: "center" })}>
        <Input
          type="search"
          placeholder="Search customer or order…"
          value={text()}
          onInput={(event) => setText(event.currentTarget.value)}
          class={css({ maxWidth: "xs" })}
        />
        <SelectField
          items={STATUS_FILTERS}
          value={table.params().status ?? "all"}
          onValueChange={(value) => table.setFilters({ status: value === "all" ? undefined : (value as OrderStatus) })}
          size="sm"
          class={css({ width: "40" })}
        />
        <div class={css({ flex: "1" })} />
        <QueryFreshness query={orders} source="orders database" />
        <Can permission={sales.perm("orders.export")}>
          <a href={exportUrl(table.params())} download="orders.csv">
            <Button variant="outline" size="xs">
              <Download size={16} />
              Export CSV
            </Button>
          </a>
        </Can>
      </div>

      <DataTable
        manual
        columns={columns}
        data={orders.data?.rows ?? []}
        rowCount={orders.data?.total ?? 0}
        getRowId={(order) => String(order.id)}
        loading={orders.isFetching}
        pagination={table.pagination()}
        onPaginationChange={table.setPagination}
        sorting={table.sorting()}
        onSortingChange={table.setSorting}
        emptyMessage="No orders match the filters."
      />
    </div>
  )
}
