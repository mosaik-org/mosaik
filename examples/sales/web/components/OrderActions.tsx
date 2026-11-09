import { formatCurrency } from "@mosaik/sdk/client"
import { createForm, useAction, useCan } from "@mosaik/sdk/solid"
import { ActionMenu, Button, Dialog, IconButton, Modal, TextField } from "@mosaik/ui"
import { css } from "@mosaik/web-sdk/css"
import { useQuery } from "@tanstack/solid-query"
import Ellipsis from "lucide-solid/icons/ellipsis"
import { createSignal, Show } from "solid-js"
import { type Order, Refund, StatusTransitions } from "../../api"
import { sales } from "../../manifest"
import { optionsQuery, salesApi } from "../queries"
import { AttachmentsDialog } from "./Attachments"
import { statusLabel } from "./StatusBadge"

const styles = {
  form: css({ display: "flex", flexDirection: "column", gap: "3" }),
  error: css({ textStyle: "sm", color: "danger.fg" }),
}

/** Row actions for an order: its attachments for everyone, and what else the principal may do. */
export const OrderActions = (props: { order: Order }) => {
  const can = useCan()
  const options = useQuery(optionsQuery)
  /** Above the largest refund in Sales' settings: finance handles it, the server refuses it. */
  const aboveLimit = () => props.order.amountCents > (options.data?.refundLimitCents ?? Number.POSITIVE_INFINITY)
  const [refunding, setRefunding] = createSignal(false)
  const [attaching, setAttaching] = createSignal(false)
  const order = () => ({ params: { id: props.order.id } })
  // Its own per row, as the footer's button submits the form from outside it.
  const formId = () => `sales-refund-${props.order.id}`

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
          <IconButton variant="ghost" aria-label={`Actions for ${props.order.number}`} size="xs" {...triggerProps()}>
            <Ellipsis size={16} />
          </IconButton>
        )}
        items={items()}
      />
      <AttachmentsDialog order={props.order} open={attaching()} onOpenChange={setAttaching} />
      {/* A confirmation that asks for a reason: a dialog with a form, as `ConfirmDialog` holds no fields. */}
      <Modal
        size="sm"
        open={refunding()}
        onOpenChange={(details) => {
          setRefunding(details.open)
          if (!details.open) form.reset()
        }}
        title={`Refund ${props.order.number}?`}
        description={`${formatCurrency(props.order.amountCents)} will be returned to ${props.order.customer}. This cannot be undone.`}
        footer={
          <>
            <Dialog.CloseTrigger
              asChild={(close) => (
                <Button variant="outline" disabled={form.submitting()} {...close()}>
                  Cancel
                </Button>
              )}
            />
            <Button type="submit" form={formId()} colorPalette="danger" loading={form.submitting()}>
              Refund
            </Button>
          </>
        }
      >
        <form id={formId()} noValidate class={styles.form} onSubmit={form.submit}>
          <TextField label="Reason" required placeholder="e.g. Damaged on arrival" {...form.field("reason")} />
          <Show when={form.error()}>
            {(error) => (
              <p role="alert" class={styles.error}>
                {error()}
              </p>
            )}
          </Show>
        </form>
      </Modal>
    </Show>
  )
}
