import { BadRequest, Conflict, type Fresh, fresh, NotFound } from "@mosaik/sdk"
import { Cache, Context, DateTime, Effect, Layer, Schema } from "effect"
import { SqlClient, SqlSchema } from "effect/sql"
import {
  DailyRevenue,
  Order,
  type OrderId,
  type OrderSortField,
  type OrderStatus,
  OrdersPage,
  RegionRevenue,
  SalesSummary,
  StatusTransitions,
} from "../api"
import { money } from "./money"

const OrderRow = Schema.Struct({ ...Order.fields, createdAt: Schema.DateTimeUtcFromDate })

const SORT_COLUMNS: Record<OrderSortField, string> = {
  createdAt: "created_at",
  amountCents: "amount_cents",
  customer: "customer",
  number: "number",
}

export interface OrderFilter {
  readonly status?: OrderStatus | undefined
  readonly search?: string | undefined
}

export interface OrderListQuery extends OrderFilter {
  readonly page: number
  readonly pageSize: number
  readonly sort: OrderSortField
  readonly direction: "asc" | "desc"
}

/** Orders repository and sales statistics. */
export class Orders extends Context.Service<
  Orders,
  {
    list(query: OrderListQuery): Effect.Effect<OrdersPage>
    all(filter: OrderFilter): Effect.Effect<ReadonlyArray<Order>>
    /** Cached for a minute (it aggregates the whole table); `asOf` says how old it is. */
    summary(days: number): Effect.Effect<Fresh<SalesSummary>>
    setStatus(id: OrderId, status: OrderStatus): Effect.Effect<Order, NotFound | BadRequest>
    /** Refuses orders above `largestCents` (Sales' settings). */
    refund(id: OrderId, reason: string, largestCents: number): Effect.Effect<Order, NotFound | Conflict>
  }
>()("@mosaik/sales/Orders") {
  static readonly layer = Layer.effect(
    Orders,
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient

      const where = (filter: OrderFilter) =>
        sql.and([
          filter.status === undefined ? sql.literal("true") : sql`status = ${filter.status}`,
          filter.search
            ? sql`(customer ILIKE ${`%${filter.search}%`} OR number ILIKE ${`%${filter.search}%`})`
            : sql.literal("true"),
        ])

      const columns = sql.literal("id, number, customer, email, region, status, amount_cents, created_at")

      const findById = SqlSchema.findOneOption({
        Request: Schema.Number,
        Result: OrderRow,
        execute: (id) => sql`SELECT ${columns} FROM orders WHERE id = ${id}`,
      })

      const get = Effect.fn("Orders.get")(function* (id: OrderId) {
        const row = yield* findById(id).pipe(Effect.orDie)
        if (row._tag === "None") return yield* new NotFound({ resource: "order", id: String(id) })
        return new Order(row.value)
      })

      const computeSummary = Effect.fn("Orders.computeSummary")(function* (days: number) {
        const since = sql`created_at >= date_trunc('day', now()) - make_interval(days => ${days - 1})`
        const counted = sql.literal("status NOT IN ('cancelled', 'refunded')")
        const [totals, daily, byRegion] = yield* Effect.all(
          [
            sql<{ revenueCents: number; orders: number; refunded: number }>`
              SELECT
                COALESCE(sum(amount_cents) FILTER (WHERE ${counted}), 0)::int AS revenue_cents,
                (count(*) FILTER (WHERE ${counted}))::int AS orders,
                (count(*) FILTER (WHERE status = 'refunded'))::int AS refunded
              FROM orders WHERE ${since}
            `,
            SqlSchema.findAll({
              Request: Schema.Void,
              Result: DailyRevenue,
              execute: () => sql`
                SELECT to_char(d.day, 'YYYY-MM-DD') AS day,
                  COALESCE(sum(o.amount_cents) FILTER (WHERE o.id IS NOT NULL AND ${counted}), 0)::int AS revenue_cents,
                  (count(o.id) FILTER (WHERE ${counted}))::int AS orders
                FROM generate_series(date_trunc('day', now()) - make_interval(days => ${days - 1}), date_trunc('day', now()), interval '1 day') AS d(day)
                LEFT JOIN orders o ON date_trunc('day', o.created_at) = d.day
                GROUP BY d.day ORDER BY d.day
              `,
            })(),
            SqlSchema.findAll({
              Request: Schema.Void,
              Result: RegionRevenue,
              execute: () => sql`
                SELECT region, COALESCE(sum(amount_cents), 0)::int AS revenue_cents
                FROM orders WHERE ${since} AND ${counted}
                GROUP BY region ORDER BY revenue_cents DESC
              `,
            })(),
          ],
          { concurrency: 3 },
        ).pipe(Effect.orDie)

        const total = totals[0] ?? { revenueCents: 0, orders: 0, refunded: 0 }
        const summary = new SalesSummary({
          days,
          revenueCents: total.revenueCents,
          orders: total.orders,
          averageOrderCents: total.orders === 0 ? 0 : Math.round(total.revenueCents / total.orders),
          refundRate: total.orders + total.refunded === 0 ? 0 : total.refunded / (total.orders + total.refunded),
          daily,
          byRegion,
        })
        return fresh(summary, yield* DateTime.now, "orders database (cached for 1 minute)")
      })

      const summaries = yield* Cache.makeWith(computeSummary, { capacity: 32, timeToLive: () => "1 minute" })

      const updateStatus = (id: OrderId, status: OrderStatus, reason: string | null = null) =>
        sql`UPDATE orders SET status = ${status}, refund_reason = ${reason}, updated_at = now() WHERE id = ${id}`.pipe(
          Effect.orDie,
          // Totals changed; the next summary request recomputes them.
          Effect.andThen(Cache.invalidateAll(summaries)),
        )

      return Orders.of({
        list: Effect.fn("Orders.list")(function* (query: OrderListQuery) {
          const order = sql.literal(
            `${SORT_COLUMNS[query.sort]} ${query.direction === "asc" ? "ASC" : "DESC"}, id DESC`,
          )
          const [rows, [count]] = yield* Effect.all(
            [
              SqlSchema.findAll({
                Request: Schema.Void,
                Result: OrderRow,
                execute: () => sql`
                  SELECT ${columns} FROM orders WHERE ${where(query)}
                  ORDER BY ${order} LIMIT ${query.pageSize} OFFSET ${query.page * query.pageSize}
                `,
              })(),
              sql<{ total: number }>`SELECT count(*)::int AS total FROM orders WHERE ${where(query)}`,
            ],
            { concurrency: 2 },
          ).pipe(Effect.orDie)
          return new OrdersPage({ rows: rows.map((row) => new Order(row)), total: count?.total ?? 0 })
        }),

        all: Effect.fn("Orders.all")(function* (filter: OrderFilter) {
          const rows = yield* SqlSchema.findAll({
            Request: Schema.Void,
            Result: OrderRow,
            execute: () => sql`SELECT ${columns} FROM orders WHERE ${where(filter)} ORDER BY created_at DESC`,
          })().pipe(Effect.orDie)
          return rows.map((row) => new Order(row))
        }),

        summary: (days: number) => Cache.get(summaries, days),

        setStatus: Effect.fn("Orders.setStatus")(function* (id: OrderId, status: OrderStatus) {
          const order = yield* get(id)
          if (!StatusTransitions[order.status].includes(status)) {
            return yield* new BadRequest({ message: `Cannot change a ${order.status} order to ${status}` })
          }
          yield* updateStatus(id, status)
          return yield* get(id).pipe(Effect.orDie)
        }),

        refund: Effect.fn("Orders.refund")(function* (id: OrderId, reason: string, largestCents: number) {
          const order = yield* get(id)
          if (order.status !== "paid" && order.status !== "shipped") {
            return yield* new Conflict({
              message: `Only paid or shipped orders can be refunded (order is ${order.status})`,
            })
          }
          if (order.amountCents > largestCents) {
            return yield* new Conflict({
              message: `Refunds above ${money.format(largestCents / 100)} are handled by finance (Sales' settings)`,
            })
          }
          yield* updateStatus(id, "refunded", reason)
          return yield* get(id).pipe(Effect.orDie)
        }),
      })
    }),
  )
}
