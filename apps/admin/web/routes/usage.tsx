import { formatNumber, formatRelativeTime } from "@mosaik/client"
import { ACTIVE_DAYS, AppsAdmin, portalApp } from "@mosaik/portal/contract"
import { css } from "@mosaik/styled-system/css"
import { createColumnHelper, DataTable } from "@mosaik/table"
import { QueryBoundary } from "@mosaik/web-kit"
import { useQuery } from "@tanstack/solid-query"
import { createFileRoute } from "@tanstack/solid-router"
import { DateTime } from "effect"
import { catalogQuery, usageQuery } from "../queries"

export const Route = createFileRoute("/_app/admin/usage")({
  staticData: {
    title: "App usage",
    keywords: ["statistics", "adoption", "users"],
    permission: AppsAdmin.manage,
  },
  component: Usage,
})

interface UsageRow {
  readonly id: string
  readonly name: string
  readonly activeUsers: number
  readonly users: number
  readonly opens: number
  /** Epoch milliseconds, so the column sorts. */
  readonly lastOpenedAt: number | null
}

const column = createColumnHelper<UsageRow>()

const columns = column.columns([
  column.accessor("name", { header: "App" }),
  column.accessor("activeUsers", {
    header: `People (last ${ACTIVE_DAYS} days)`,
    cell: (info) => formatNumber(info.getValue()),
  }),
  column.accessor("users", { header: "People (ever)", cell: (info) => formatNumber(info.getValue()) }),
  column.accessor("opens", { header: "Times opened", cell: (info) => formatNumber(info.getValue()) }),
  column.accessor("lastOpenedAt", {
    header: "Last opened",
    cell: (info) => {
      const at = info.getValue()
      return at === null ? "Never" : formatRelativeTime(at)
    },
  }),
])

/** How much each app is used: the ones nobody opens are candidates to retire. */
function Usage() {
  const catalog = useQuery(catalogQuery)
  const usage = useQuery(usageQuery)

  // Every registered app, also the ones nobody opened yet; the Portal registers permissions, but is not an app.
  const rows = (): ReadonlyArray<UsageRow> => {
    const stats = new Map((usage.data ?? []).map((entry) => [entry.app, entry]))
    return (catalog.data ?? [])
      .filter((app) => app.id !== portalApp.id)
      .map((app) => {
        const entry = stats.get(app.id)
        return {
          id: app.id,
          name: app.name,
          activeUsers: entry?.activeUsers ?? 0,
          users: entry?.users ?? 0,
          opens: entry?.opens ?? 0,
          lastOpenedAt: entry?.lastOpenedAt == null ? null : DateTime.toEpochMillis(entry.lastOpenedAt),
        }
      })
      .toSorted((a, b) => b.activeUsers - a.activeUsers || a.name.localeCompare(b.name))
  }

  return (
    <div class={css({ display: "flex", flexDirection: "column", gap: "4" })}>
      <p class={css({ fontSize: "sm", color: "fg.muted" })}>
        Counted each time someone goes into an app. Uninstalling an app removes its numbers.
      </p>
      <QueryBoundary query={usage}>
        {() => <DataTable columns={columns} data={rows()} getRowId={(row) => row.id} loading={catalog.isFetching} />}
      </QueryBoundary>
    </div>
  )
}
