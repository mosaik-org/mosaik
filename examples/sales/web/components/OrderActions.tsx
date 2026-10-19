import { formatCurrency } from "@mosaik/sdk/client"
import { createForm, useAction, useCan } from "@mosaik/sdk/solid"
import { ConfirmDialog, IconButton, Menu, TextField } from "@mosaik/sdk/ui"
import Ellipsis from "lucide-solid/icons/ellipsis"
import { createSignal, Show } from "solid-js"
import { type Order, Refund, StatusTransitions } from "../../api"
import { sales } from "../../manifest"
import { salesApi } from "../queries"
import { statusLabel } from "./StatusBadge"

/** Row actions for an order; only shows what the principal may do. */
export const OrderActions = (props: { order: Order }) => {
  const can = useCan()
  const [refunding, setRefunding] = createSignal(false)
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
    ...(can(sales.perm("orders.edit"))
      ? StatusTransitions[props.order.status].map((status) => ({
          value: status,
          label: `Mark as ${statusLabel(status).toLowerCase()}`,
          onSelect: () => void setStatus.run({ ...order(), payload: { status } }),
        }))
      : []),
    ...(can(sales.perm("orders.refund")) && (props.order.status === "paid" || props.order.status === "shipped")
      ? [{ value: "refund", label: "Refund…", danger: true, onSelect: () => setRefunding(true) }]
      : []),
  ]

  return (
    <Show when={items().length > 0}>
      <Menu
        trigger={(triggerProps) => (
          <IconButton label={`Actions for ${props.order.number}`} size="sm" {...triggerProps}>
            <Ellipsis size={16} />
          </IconButton>
        )}
        items={items()}
      />
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
