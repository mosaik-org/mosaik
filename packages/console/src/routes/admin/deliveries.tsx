import { admin } from "@mosaik/auth/contract"
import { useCan } from "@mosaik/auth/web"
import { errorMessage, formatDateTime, toast } from "@mosaik/client"
import { Badge, Button, SelectField } from "@mosaik/mosaik-ui"
import { type DeliveryRecord, DeliveryStatus } from "@mosaik/notifications/contract"
import { css } from "@mosaik/styled-system/css"
import { createColumnHelper, DataTable } from "@mosaik/table"
import { QueryBoundary, searchValidator } from "@mosaik/web-kit"
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/solid-query"
import { createFileRoute } from "@tanstack/solid-router"
import { Schema } from "effect"
import { Show } from "solid-js"
import { adminKeys, deliveriesQuery } from "../../admin/queries"
import { notificationsApi } from "../../api"

/** The color palette a badge shows a state in. */
type Tone = "gray" | "accent" | "success" | "warning" | "danger"

const DeliveriesSearch = Schema.Struct({ status: Schema.optional(DeliveryStatus) })

export const Route = createFileRoute("/_app/admin/deliveries")({
  staticData: {
    title: "Delivery log",
    keywords: ["email", "messages", "notifications", "failed", "smtp"],
    permission: admin.perm("notifications.view"),
  },
  validateSearch: searchValidator(DeliveriesSearch),
  component: Deliveries,
})

const STATUS: Record<DeliveryStatus, { tone: Tone; label: string }> = {
  pending: { tone: "warning", label: "Pending" },
  sending: { tone: "accent", label: "Sending" },
  sent: { tone: "success", label: "Sent" },
  failed: { tone: "danger", label: "Failed" },
}

const CHANNELS: Record<string, string> = { email: "E-mail", "slack-user": "Slack DM", target: "Channel" }

const FILTERS = [
  { value: "all", label: "All deliveries" },
  { value: "failed", label: "Failed" },
  { value: "pending", label: "Pending (retrying)" },
  { value: "sent", label: "Sent" },
] as const

const RetryButton = (props: { delivery: DeliveryRecord }) => {
  const queryClient = useQueryClient()
  const retry = useMutation(() => ({
    mutationFn: () => notificationsApi((client) => client.admin.retryDelivery({ params: { id: props.delivery.id } })),
    onSuccess: () => {
      toast.success("Delivery queued again")
      void queryClient.invalidateQueries({ queryKey: adminKeys.notifications })
    },
    onError: (error: unknown) => toast.error("Could not retry", errorMessage(error)),
  }))
  return (
    <Button size="xs" variant="outline" loading={retry.isPending} onClick={() => retry.mutate()}>
      Retry
    </Button>
  )
}

const column = createColumnHelper<DeliveryRecord>()

function Deliveries() {
  const can = useCan()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const deliveries = useInfiniteQuery(() => deliveriesQuery(search().status))
  const entries = () => deliveries.data?.pages.flatMap((page) => page.entries) ?? []

  const columns = column.columns([
    column.accessor("createdAt", {
      header: "Queued",
      enableSorting: false,
      cell: (info) => formatDateTime(info.getValue()),
    }),
    column.accessor("title", {
      header: "Message",
      enableSorting: false,
      cell: (info) => (
        <div>
          <div class={css({ fontWeight: "medium" })}>{info.getValue()}</div>
          <div class={css({ fontSize: "xs", color: "fg.muted" })}>
            {info.row.original.source}
            {info.row.original.kind ? ` · ${info.row.original.kind}` : ""}
            {info.row.original.category === "notification" ? " · notification" : ""}
          </div>
        </div>
      ),
    }),
    column.accessor("recipient", {
      header: "To",
      enableSorting: false,
      cell: (info) => (
        <div>
          <div class={css({ fontSize: "sm" })}>{info.getValue()}</div>
          <div class={css({ fontSize: "xs", color: "fg.muted" })}>
            {CHANNELS[info.row.original.channel] ?? info.row.original.channel}
          </div>
        </div>
      ),
    }),
    column.accessor("status", {
      header: "Status",
      enableSorting: false,
      cell: (info) => (
        <div class={css({ display: "flex", flexDirection: "column", gap: "1", alignItems: "flex-start" })}>
          <Badge variant="dot" colorPalette={STATUS[info.getValue()].tone}>
            {STATUS[info.getValue()].label}
          </Badge>
          <Show when={info.row.original.attempts > 1}>
            <span class={css({ fontSize: "xs", color: "fg.muted" })}>{info.row.original.attempts} attempts</span>
          </Show>
        </div>
      ),
    }),
    column.accessor("lastError", {
      header: "Last error",
      enableSorting: false,
      cell: (info) => (
        <span class={css({ fontSize: "xs", color: "fg.muted", wordBreak: "break-word" })}>
          {info.getValue() ?? "—"}
        </span>
      ),
    }),
    column.display({
      id: "actions",
      header: "",
      meta: { align: "right", width: "88px" },
      cell: (info) => (
        <Show when={info.row.original.status === "failed" && can(admin.perm("notifications.manage"))}>
          <RetryButton delivery={info.row.original} />
        </Show>
      ),
    }),
  ])

  return (
    <div class={css({ display: "flex", flexDirection: "column", gap: "4" })}>
      <SelectField
        aria-label="Status"
        items={FILTERS}
        value={search().status ?? "all"}
        onValueChange={(value) =>
          void navigate({ search: { status: value === "all" ? undefined : (value ?? undefined) } })
        }
        size="sm"
        class={css({ width: "56" })}
      />
      <QueryBoundary query={deliveries}>
        {() => (
          <>
            <DataTable
              columns={columns}
              data={entries()}
              getRowId={(delivery) => String(delivery.id)}
              loading={deliveries.isFetching}
              pageSizes={[50, 100, 200]}
              emptyMessage="Nothing was sent yet."
            />
            <Show when={deliveries.hasNextPage}>
              <div class={css({ display: "flex", justifyContent: "center" })}>
                <Button
                  variant="outline"
                  loading={deliveries.isFetchingNextPage}
                  onClick={() => void deliveries.fetchNextPage()}
                >
                  Load older deliveries
                </Button>
              </div>
            </Show>
          </>
        )}
      </QueryBoundary>
    </div>
  )
}
