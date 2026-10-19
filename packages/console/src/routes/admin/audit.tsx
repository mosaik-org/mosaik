import { type AuditRecord, admin } from "@mosaik/auth/contract"
import { formatDateTime } from "@mosaik/client"
import { css } from "@mosaik/styled-system/css"
import { createColumnHelper, DataTable } from "@mosaik/table"
import { Badge, Button, Select } from "@mosaik/ui"
import { QueryBoundary, searchValidator } from "@mosaik/web-kit"
import { useInfiniteQuery, useQuery } from "@tanstack/solid-query"
import { createFileRoute } from "@tanstack/solid-router"
import { Schema } from "effect"
import { Show } from "solid-js"
import { auditQuery, catalogQuery } from "../../admin/queries"

const AuditSearch = Schema.Struct({ app: Schema.optional(Schema.String) })

export const Route = createFileRoute("/_app/admin/audit")({
  staticData: { title: "Audit log", keywords: ["history", "activity"], permission: admin.perm("audit.view") },
  validateSearch: searchValidator(AuditSearch),
  component: Audit,
})

const column = createColumnHelper<AuditRecord>()

const columns = column.columns([
  column.accessor("at", { header: "Time", enableSorting: false, cell: (info) => formatDateTime(info.getValue()) }),
  column.accessor("app", {
    header: "App",
    enableSorting: false,
    cell: (info) => <Badge>{info.getValue()}</Badge>,
  }),
  column.accessor("action", {
    header: "Action",
    enableSorting: false,
    cell: (info) => <span class={css({ fontFamily: "mono", fontSize: "xs" })}>{info.getValue()}</span>,
  }),
  column.accessor("target", { header: "Target", enableSorting: false, cell: (info) => info.getValue() ?? "—" }),
  column.accessor("actorEmail", { header: "By", enableSorting: false, cell: (info) => info.getValue() ?? "system" }),
  column.accessor("details", {
    header: "Details",
    enableSorting: false,
    cell: (info) => {
      const details = info.getValue()
      return Object.keys(details).length === 0 ? (
        "—"
      ) : (
        <code class={css({ fontSize: "xs", color: "fg.muted", whiteSpace: "pre-wrap", wordBreak: "break-word" })}>
          {JSON.stringify(details)}
        </code>
      )
    },
  }),
])

function Audit() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const catalog = useQuery(catalogQuery)
  const audit = useInfiniteQuery(() => auditQuery(search().app))

  const filters = () => [
    { value: "all", label: "All apps" },
    ...(catalog.data ?? []).map((d) => ({ value: d.id, label: d.name })),
  ]
  const entries = () => audit.data?.pages.flatMap((page) => page.entries) ?? []

  return (
    <div class={css({ display: "flex", flexDirection: "column", gap: "4" })}>
      <Select
        items={filters()}
        value={search().app ?? "all"}
        onValueChange={(value) => void navigate({ search: { app: value === "all" ? undefined : value } })}
        size="sm"
        class={css({ width: "56" })}
      />
      <QueryBoundary query={audit}>
        {() => (
          <>
            <DataTable
              columns={columns}
              data={entries()}
              getRowId={(entry) => String(entry.id)}
              loading={audit.isFetching}
              pageSizes={[50, 100, 200]}
              emptyMessage="Nothing has happened yet."
            />
            <Show when={audit.hasNextPage}>
              <div class={css({ display: "flex", justifyContent: "center" })}>
                <Button variant="outline" loading={audit.isFetchingNextPage} onClick={() => void audit.fetchNextPage()}>
                  Load older entries
                </Button>
              </div>
            </Show>
          </>
        )}
      </QueryBoundary>
    </div>
  )
}
