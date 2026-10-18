import { errorMessage, formatCurrency } from "@mosaik/sdk/client"
import { useCan } from "@mosaik/sdk/solid"
import { ConfirmDialog, IconButton, Menu, TextField, toast } from "@mosaik/sdk/ui"
import { useMutation, useQueryClient } from "@tanstack/solid-query"
import Ellipsis from "lucide-solid/icons/ellipsis"
import { createSignal, Show } from "solid-js"
import { type Order, type OrderStatus, StatusTransitions } from "../../api"
import { sales } from "../../manifest"
import { salesApi, salesKeys } from "../queries"
import { statusLabel } from "./StatusBadge"

/** Row actions for an order; only shows what the principal may do. */
export const OrderActions = (props: { order: Order }) => {
  const can = useCan()
  const queryClient = useQueryClient()
  const [refunding, setRefunding] = createSignal(false)
  const [reason, setReason] = createSignal("")

  const onSuccess = (order: Order, message: string) => {
    toast.success(message, order.number)
    void queryClient.invalidateQueries({ queryKey: salesKeys.all })
  }
  const onError = (error: unknown) => toast.error("Action failed", errorMessage(error))

  const setStatus = useMutation(() => ({
    mutationFn: (status: OrderStatus) =>
      salesApi((client) => client.orders.setStatus({ params: { id: props.order.id }, payload: { status } })),
    onSuccess: (order) => onSuccess(order, `Order marked as ${statusLabel(order.status).toLowerCase()}`),
    onError,
  }))

  const refund = useMutation(() => ({
    mutationFn: (reason: string) =>
      salesApi((client) => client.orders.refund({ params: { id: props.order.id }, payload: { reason } })),
    onSuccess: (order) => {
      setRefunding(false)
      setReason("")
      onSuccess(order, "Order refunded")
    },
    onError,
  }))

  const items = () => [
    ...(can(sales.perm("orders.edit"))
      ? StatusTransitions[props.order.status].map((status) => ({
          value: status,
          label: `Mark as ${statusLabel(status).toLowerCase()}`,
          onSelect: () => setStatus.mutate(status),
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
        onOpenChange={setRefunding}
        title={`Refund ${props.order.number}?`}
        description={`${formatCurrency(props.order.amountCents)} will be returned to ${props.order.customer}. This cannot be undone.`}
        confirmLabel="Refund"
        tone="danger"
        loading={refund.isPending}
        onConfirm={() => {
          if (reason().trim().length === 0) return toast.error("A reason is required")
          refund.mutate(reason().trim())
        }}
      >
        <TextField
          label="Reason"
          required
          value={reason()}
          onValueChange={setReason}
          placeholder="e.g. Damaged on arrival"
        />
      </ConfirmDialog>
    </Show>
  )
}
