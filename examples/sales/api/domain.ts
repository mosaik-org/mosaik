import { Schema } from "effect"

export const OrderId = Schema.Int.pipe(Schema.brand("@mosaik/sales/OrderId"))
export type OrderId = typeof OrderId.Type

export const OrderStatus = Schema.Literals(["pending", "paid", "shipped", "refunded", "cancelled"])
export type OrderStatus = typeof OrderStatus.Type

/** Status changes allowed through `orders.edit` (refunds have their own permission). */
export const StatusTransitions: Record<OrderStatus, ReadonlyArray<OrderStatus>> = {
  pending: ["paid", "cancelled"],
  paid: ["shipped", "cancelled"],
  shipped: [],
  refunded: [],
  cancelled: [],
}

export const Region = Schema.Literals(["EMEA", "NA", "LATAM", "APAC"])
export type Region = typeof Region.Type

export class Order extends Schema.Class<Order>("@mosaik/sales/Order")({
  id: OrderId,
  number: Schema.String,
  customer: Schema.String,
  email: Schema.String,
  region: Region,
  status: OrderStatus,
  amountCents: Schema.Int,
  createdAt: Schema.DateTimeUtc,
}) {}

/** A file attached to an order, kept in the platform's storage under `orders/<id>/<name>`. */
export class Attachment extends Schema.Class<Attachment>("@mosaik/sales/Attachment")({
  name: Schema.String,
  size: Schema.Number,
  contentType: Schema.String,
  uploadedAt: Schema.DateTimeUtc,
}) {}

/** What Sales takes as attachments: PDFs and images, up to 10 MB (it checks; the platform only counts). */
export const ATTACHMENT_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/webp"] as const
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024

/** What the pages need of Sales' settings (the rest stays on the server). */
export class OrderOptions extends Schema.Class<OrderOptions>("@mosaik/sales/OrderOptions")({
  exportsEnabled: Schema.Boolean,
  /** The largest refund allowed; larger ones are refused. */
  refundLimitCents: Schema.Int,
}) {}

export const OrderSortField = Schema.Literals(["createdAt", "amountCents", "customer", "number"])
export type OrderSortField = typeof OrderSortField.Type

export const SortDirection = Schema.Literals(["asc", "desc"])

/**
 * Orders table state. The same schema is the API query and the page's URL search
 * params, so `/sales/orders?status=paid&sort=amountCents` maps 1:1 to an API call.
 */
export const OrdersSearch = Schema.Struct({
  page: Schema.optional(Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))),
  pageSize: Schema.optional(Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 100 }))),
  sort: Schema.optional(OrderSortField),
  direction: Schema.optional(SortDirection),
  status: Schema.optional(OrderStatus),
  search: Schema.optional(Schema.String),
})
export type OrdersSearch = typeof OrdersSearch.Type

export const ORDERS_DEFAULTS = {
  page: 0,
  pageSize: 20,
  sort: "createdAt",
  direction: "desc",
} as const satisfies OrdersSearch

export const SummarySearch = Schema.Struct({
  days: Schema.optional(Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 365 }))),
})
export type SummarySearch = typeof SummarySearch.Type

export const SUMMARY_DEFAULTS = { days: 30 } as const satisfies SummarySearch

export class OrdersPage extends Schema.Class<OrdersPage>("@mosaik/sales/OrdersPage")({
  rows: Schema.Array(Order),
  total: Schema.Int,
}) {}

export class DailyRevenue extends Schema.Class<DailyRevenue>("@mosaik/sales/DailyRevenue")({
  /** `YYYY-MM-DD` */
  day: Schema.String,
  revenueCents: Schema.Int,
  orders: Schema.Int,
}) {}

export class RegionRevenue extends Schema.Class<RegionRevenue>("@mosaik/sales/RegionRevenue")({
  region: Region,
  revenueCents: Schema.Int,
}) {}

export class SalesSummary extends Schema.Class<SalesSummary>("@mosaik/sales/SalesSummary")({
  days: Schema.Int,
  revenueCents: Schema.Int,
  orders: Schema.Int,
  averageOrderCents: Schema.Int,
  refundRate: Schema.Number,
  daily: Schema.Array(DailyRevenue),
  byRegion: Schema.Array(RegionRevenue),
}) {}

/** Why an order is refunded; the refund dialog checks it with the same Schema as the API. */
export class Refund extends Schema.Class<Refund>("@mosaik/sales/Refund")({
  reason: Schema.String.check(
    Schema.isTrimmed({ message: "No spaces around it" }),
    Schema.isMinLength(1, { message: "Say why the order is refunded" }),
    Schema.isMaxLength(500),
  ),
}) {}
