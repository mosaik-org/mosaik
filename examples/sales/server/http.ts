import { CurrentPrincipal } from "@mosaik/sdk"
import { Audiences, Audit, Notify } from "@mosaik/sdk/server"
import { DateTime, Effect, Layer } from "effect"
import { HttpApiBuilder } from "effect/http-api"
import { ORDERS_DEFAULTS, type Order, SalesApi, SUMMARY_DEFAULTS } from "../api"
import { sales } from "../manifest"

const money = new Intl.NumberFormat("en", { style: "currency", currency: "EUR" })

import { Orders } from "./Orders"

const csvCell = (value: string | number): string => {
  const text = String(value)
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

const toCsv = (orders: ReadonlyArray<Order>): string =>
  [
    ["number", "customer", "email", "region", "status", "amount", "created_at"].join(","),
    ...orders.map((o) =>
      [
        o.number,
        o.customer,
        o.email,
        o.region,
        o.status,
        (o.amountCents / 100).toFixed(2),
        DateTime.formatIso(o.createdAt),
      ]
        .map(csvCell)
        .join(","),
    ),
  ].join("\n")

const StatsHandlers = HttpApiBuilder.group(
  SalesApi,
  "stats",
  Effect.fn(function* (handlers) {
    const orders = yield* Orders
    return handlers.handle("summary", ({ query }) => orders.summary(query.days ?? SUMMARY_DEFAULTS.days))
  }),
)

const OrdersHandlers = HttpApiBuilder.group(
  SalesApi,
  "orders",
  Effect.fn(function* (handlers) {
    const orders = yield* Orders
    const audit = yield* Audit
    const notify = yield* Notify

    return handlers.handleAll({
      list: ({ query }) => orders.list({ ...ORDERS_DEFAULTS, ...query }),

      export: Effect.fn(function* ({ query }) {
        const rows = yield* orders.all(query)
        yield* audit.record({ action: "orders.export", details: { rows: rows.length, ...query } })
        return toCsv(rows)
      }),

      setStatus: Effect.fn(function* ({ params, payload }) {
        const order = yield* orders.setStatus(params.id, payload.status)
        yield* audit.record({ action: "orders.set-status", target: order.number, details: { status: payload.status } })
        return order
      }),

      refund: Effect.fn(function* ({ params, payload }) {
        const order = yield* orders.refund(params.id, payload.reason)
        yield* audit.record({
          action: "orders.refund",
          target: order.number,
          details: { reason: payload.reason, amountCents: order.amountCents },
        })
        // Tell the others who handle refunds; a failed notification never fails the refund.
        const actor = (yield* CurrentPrincipal).user
        yield* notify
          .send({
            type: sales.notification("order.refunded"),
            audience: Audiences.permission(sales.perm("orders.refund")),
            exclude: actor === null ? [] : [actor.id],
            content: {
              title: `${order.number} was refunded`,
              body: `${actor?.name ?? "Someone"} refunded ${order.customer}.\n\nReason: ${payload.reason}`,
              fields: [
                { label: "Amount", value: money.format(order.amountCents / 100) },
                { label: "Region", value: order.region },
              ],
              link: `/sales/orders?search=${encodeURIComponent(order.number)}`,
              linkLabel: "View order",
            },
            idempotencyKey: `refund-${order.id}`,
          })
          .pipe(Effect.ignore)
        return order
      }),
    })
  }),
)

export const Handlers = Layer.mergeAll(StatsHandlers, OrdersHandlers).pipe(Layer.provide(Orders.layer))
