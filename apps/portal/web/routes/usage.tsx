import { formatNumber, formatRelativeTime } from "@mosaik/client"
import { ACTIVE_DAYS, AppsAdmin } from "@mosaik/portal/contract"
import { css } from "@mosaik/styled-system/css"
import { createColumnHelper, DataTable } from "@mosaik/table"
import { QueryBoundary } from "@mosaik/web-kit"
import { useQuery } from "@tanstack/solid-query"
import { createFileRoute } from "@tanstack/solid-router"
import { DateTime } from "effect"
import { appsQuery, usageQuery } from "../queries"

export const Route = createFileRoute("/_app/portal/usage")({
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
  const apps = useQuery(appsQuery)
  const usage = useQuery(usageQuery)

  // Every app Core knows, also the ones nobody opened yet, and every app someone opened (built-in ones too).
  const rows = (): ReadonlyArray<UsageRow> => {
    const stats = new Map((usage.data ?? []).map((entry) => [entry.app, entry]))
    const names = new Map((apps.data ?? []).map((app) => [app.id, app.name]))
    return [...new Set([...names.keys(), ...stats.keys()])]
      .map((id) => {
        const entry = stats.get(id)
        return {
          id,
          name: names.get(id) ?? id,
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
        {() => (
          <DataTable
            columns={columns}
            data={rows()}
            getRowId={(row) => row.id}
            loading={apps.isFetching || usage.isFetching}
          />
        )}
      </QueryBoundary>
    </div>
  )
}
