import { Badge } from "@mosaik/mosaik-ui"
import type { OrderStatus } from "../../api"

const TONES = {
  pending: "warning",
  paid: "accent",
  shipped: "success",
  refunded: "danger",
  cancelled: "neutral",
} as const

const LABELS: Record<OrderStatus, string> = {
  pending: "Pending",
  paid: "Paid",
  shipped: "Shipped",
  refunded: "Refunded",
  cancelled: "Cancelled",
}

export const statusLabel = (status: OrderStatus): string => LABELS[status]

export const StatusBadge = (props: { status: OrderStatus }) => (
  <Badge variant="dot" colorPalette={TONES[props.status]}>
    {LABELS[props.status]}
  </Badge>
)
