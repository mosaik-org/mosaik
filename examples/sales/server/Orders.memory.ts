import { BadRequest, Conflict, fresh, NotFound } from "@mosaik/sdk"
import { DateTime, Effect, Layer, Ref } from "effect"
import { Order, type OrderId, OrdersPage, SalesSummary, StatusTransitions } from "../api"
import { type OrderFilter, Orders } from "./Orders"

/**
 * `Orders` kept in memory, for Sales' tests: the same service without Postgres, so tests of the API
 * run anywhere and at once. It keeps the data's own rules (which statuses follow which); the rules of
 * the API (permissions, Sales' settings, what is audited and notified) stay in the handlers, which the
 * tests exercise for real.
 */
export const InMemoryOrders = (seed: ReadonlyArray<Order>) =>
  Layer.effect(
    Orders,
    Effect.gen(function* () {
      const orders = yield* Ref.make(new Map(seed.map((order) => [order.id, order])))

      const get = (id: OrderId) =>
        Effect.flatMap(Ref.get(orders), (all) => {
          const order = all.get(id)
          return order === undefined
            ? Effect.fail(new NotFound({ resource: "order", id: String(id) }))
            : Effect.succeed(order)
        })
      const update = (order: Order) => Ref.update(orders, (all) => new Map(all).set(order.id, order))
      const matching = (filter: OrderFilter) =>
        Effect.map(Ref.get(orders), (all) =>
          [...all.values()].filter(
            (order) =>
              (filter.status === undefined || order.status === filter.status) &&
              (filter.search === undefined ||
                `${order.number} ${order.customer} ${order.email}`.toLowerCase().includes(filter.search.toLowerCase())),
          ),
        )

      return Orders.of({
        get,
        all: matching,
        list: (query) =>
          Effect.map(matching(query), (rows) => {
            const sorted = rows.toSorted((a, b) => {
              const [x, y] = [a[query.sort], b[query.sort]]
              const order =
                DateTime.isDateTime(x) && DateTime.isDateTime(y) ? DateTime.Order(x, y) : x < y ? -1 : x > y ? 1 : 0
              return query.direction === "asc" ? order : -order
            })
            const start = query.page * query.pageSize
            return new OrdersPage({ rows: sorted.slice(start, start + query.pageSize), total: rows.length })
          }),
        summary: (days) =>
          Effect.gen(function* () {
            const counted = (yield* matching({})).filter(
              (order) => order.status !== "cancelled" && order.status !== "refunded",
            )
            const revenueCents = counted.reduce((sum, order) => sum + order.amountCents, 0)
            const summary = new SalesSummary({
              days,
              revenueCents,
              orders: counted.length,
              averageOrderCents: counted.length === 0 ? 0 : Math.round(revenueCents / counted.length),
              refundRate: 0,
              daily: [],
              byRegion: [],
            })
            return fresh(summary, yield* DateTime.now, "orders in memory")
          }),
        setStatus: (id, status) =>
          Effect.gen(function* () {
            const order = yield* get(id)
            if (!StatusTransitions[order.status].includes(status)) {
              return yield* new BadRequest({ message: `Cannot change a ${order.status} order to ${status}` })
            }
            const changed = new Order({ ...order, status })
            yield* update(changed)
            return changed
          }),
        refund: (id) =>
          Effect.gen(function* () {
            const order = yield* get(id)
            if (order.status !== "paid" && order.status !== "shipped") {
              return yield* new Conflict({
                message: `Only paid or shipped orders can be refunded (order is ${order.status})`,
              })
            }
            const refunded = new Order({ ...order, status: "refunded" })
            yield* update(refunded)
            return refunded
          }),
      })
    }),
  )
