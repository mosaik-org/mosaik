import { ActionMenu, ConfirmDialog, IconButton, TextField } from "@mosaik/mosaik-ui"
import { formatCurrency } from "@mosaik/sdk/client"
import { createForm, useAction, useCan } from "@mosaik/sdk/solid"
import { useQuery } from "@tanstack/solid-query"
import Ellipsis from "lucide-solid/icons/ellipsis"
import { createSignal, Show } from "solid-js"
import { type Order, Refund, StatusTransitions } from "../../api"
import { sales } from "../../manifest"
import { optionsQuery, salesApi } from "../queries"
import { AttachmentsDialog } from "./Attachments"
import { statusLabel } from "./StatusBadge"

/** Row actions for an order: its attachments for everyone, and what else the principal may do. */
export const OrderActions = (props: { order: Order }) => {
  const can = useCan()
  const options = useQuery(optionsQuery)
  /** Above the largest refund in Sales' settings: finance handles it, the server refuses it. */
  const aboveLimit = () => props.order.amountCents > (options.data?.refundLimitCents ?? Number.POSITIVE_INFINITY)
  const [refunding, setRefunding] = createSignal(false)
  const [attaching, setAttaching] = createSignal(false)
  const order = () => ({ params: { id: props.order.id } })

  // Both change what the orders list and the summary show: refetch everything of the app.
  const setStatus = useAction(salesApi.orders.setStatus, {
    success: (order) => `${order.number} marked as ${statusLabel(order.status).toLowerCase()}`,
    invalidates: [salesApi],
  })
  const refund = useAction(salesApi.orders.refund, {
    success: (order) => `${order.number} was refunded`,
    invalidates: [salesApi],
  })

  // The same Schema as the API's payload: the dialog checks what the server will.
  const form = createForm({
    schema: Refund,
    initial: { reason: "" },
    onSubmit: async (payload) => {
      await refund.submit({ ...order(), payload })
      setRefunding(false)
      form.reset()
    },
  })

  const items = () => [
    { value: "attachments", label: "Attachments…", onSelect: () => setAttaching(true) },
    ...(can(sales.perm("orders.edit"))
      ? StatusTransitions[props.order.status].map((status) => ({
          value: status,
          label: `Mark as ${statusLabel(status).toLowerCase()}`,
          onSelect: () => void setStatus.run({ ...order(), payload: { status } }),
        }))
      : []),
    ...(can(sales.perm("orders.refund")) && (props.order.status === "paid" || props.order.status === "shipped")
      ? [
          {
            value: "refund",
            label: aboveLimit() ? "Refund (above the limit: finance)" : "Refund…",
            danger: true,
            disabled: aboveLimit(),
            onSelect: () => setRefunding(true),
          },
        ]
      : []),
  ]

  return (
    <Show when={items().length > 0}>
      <ActionMenu
        trigger={(triggerProps) => (
          <IconButton variant="plain" aria-label={`Actions for ${props.order.number}`} size="2xs" {...triggerProps()}>
            <Ellipsis size={16} />
          </IconButton>
        )}
        items={items()}
      />
      <AttachmentsDialog order={props.order} open={attaching()} onOpenChange={setAttaching} />
      <ConfirmDialog
        open={refunding()}
        onOpenChange={(open) => {
          setRefunding(open)
          if (!open) form.reset()
        }}
        title={`Refund ${props.order.number}?`}
        description={`${formatCurrency(props.order.amountCents)} will be returned to ${props.order.customer}. This cannot be undone.`}
        confirmLabel="Refund"
        tone="danger"
        loading={form.submitting()}
        onConfirm={() => void form.submit()}
      >
        <TextField label="Reason" required placeholder="e.g. Damaged on arrival" {...form.field("reason")} />
        <Show when={form.error()}>{(error) => <p role="alert">{error()}</p>}</Show>
      </ConfirmDialog>
    </Show>
  )
}
