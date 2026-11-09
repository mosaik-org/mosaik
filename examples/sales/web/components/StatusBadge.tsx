import { Badge } from "@mosaik/ui"
import type { OrderStatus } from "../../api"

const LABELS: Record<OrderStatus, string> = {
  pending: "Pending",
  paid: "Paid",
  shipped: "Shipped",
  refunded: "Refunded",
  cancelled: "Cancelled",
}

export const statusLabel = (status: OrderStatus): string => LABELS[status]

/** An order's status: grey, but amber while it waits for approval, the one status someone must act on. */
export const StatusBadge = (props: { status: OrderStatus }) => (
  <Badge size="sm" colorPalette={props.status === "pending" ? "warning" : undefined}>
    {LABELS[props.status]}
  </Badge>
)
