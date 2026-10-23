import { describe, expect, layer } from "@effect/vitest"
import { Audiences } from "@mosaik/sdk/server"
import { AppTest, TestAudit, TestNotify, TestSettings } from "@mosaik/sdk/testing"
import { DateTime, Effect, Layer } from "effect"
import { Order, OrderId, Refund, SalesApi } from "../api"
import { sales } from "../manifest"
import { ApiHandlers } from "./http"
import { InMemoryOrders } from "./Orders.memory"

const order = (id: number, amountCents: number, status: Order["status"] = "paid") =>
  new Order({
    id: OrderId.make(id),
    number: `SO-${id}`,
    customer: "Initech",
    email: "billing@initech.example",
    region: "EMEA",
    status,
    amountCents,
    createdAt: DateTime.makeUnsafe("2026-10-20T09:00:00Z"),
  })

// Every order its own test needs: tests of one layer share the app, as requests share a running one.
const orders = [order(1, 49_011), order(2, 4_200), order(3, 2_500), order(4, 1_000, "pending")]

const viewer = AppTest.user({ id: "grace", name: "Grace", grants: [sales.accessPermission] })
const refunder = AppTest.user({ id: "ada", name: "Ada", grants: [sales.accessPermission, sales.perm("orders.refund")] })
const manager = AppTest.user({ id: "lin", name: "Lin", grants: [sales.accessPermission, "sales:orders.*"] })

const app = AppTest.layer({
  app: sales,
  api: SalesApi,
  handlers: ApiHandlers.pipe(Layer.provide(InMemoryOrders(orders))),
})

layer(app)("Sales", (it) => {
  describe("refunds", () => {
    it.effect("need orders.refund", () =>
      Effect.gen(function* () {
        const api = yield* AppTest.client(SalesApi)
        const error = yield* Effect.flip(
          api.as(viewer, (client) =>
            client.orders.refund({ params: { id: OrderId.make(2) }, payload: new Refund({ reason: "Damaged" }) }),
          ),
        )
        expect(error._tag).toBe("Forbidden")
      }),
    )

    it.effect("above the largest refund in Sales' settings go to finance", () =>
      Effect.gen(function* () {
        const api = yield* AppTest.client(SalesApi)
        yield* (yield* TestSettings.for(sales)).set("refundLimit", 100)
        const error = yield* Effect.flip(
          api.as(refunder, (client) =>
            client.orders.refund({ params: { id: OrderId.make(1) }, payload: new Refund({ reason: "Damaged" }) }),
          ),
        )
        expect(error).toMatchObject({ _tag: "Conflict", message: expect.stringContaining("€100.00") })
        const [still] = (yield* api.as(viewer, (client) => client.orders.list({ query: { search: "SO-1" } }))).rows
        expect(still?.status).toBe("paid")
        yield* (yield* TestSettings).reset
      }),
    )

    it.effect("are audited, and tell the others who handle refunds", () =>
      Effect.gen(function* () {
        const api = yield* AppTest.client(SalesApi)
        const refunded = yield* api.as(refunder, (client) =>
          client.orders.refund({ params: { id: OrderId.make(2) }, payload: new Refund({ reason: "Arrived broken" }) }),
        )
        expect(refunded.status).toBe("refunded")
        expect(yield* (yield* TestAudit).entries).toContainEqual(
          expect.objectContaining({
            action: "orders.refund",
            target: "SO-2",
            actor: expect.objectContaining({ id: "ada" }),
          }),
        )
        const [notification] = (yield* (yield* TestNotify).sent).filter(
          (sent) => sent.content.title === "SO-2 was refunded",
        )
        expect(notification).toMatchObject({
          type: sales.notification("order.refunded"),
          audience: Audiences.permission(sales.perm("orders.refund")),
          exclude: ["ada"],
        })
      }),
    )
  })

  it.effect("refuses CSV exports while they are switched off", () =>
    Effect.gen(function* () {
      const api = yield* AppTest.client(SalesApi)
      yield* (yield* TestSettings.for(sales)).set("exportsEnabled", false)
      const error = yield* Effect.flip(api.as(manager, (client) => client.orders.export({ query: {} })))
      expect(error).toMatchObject({ _tag: "Conflict", message: "Exports are switched off in Sales' settings" })
      yield* (yield* TestSettings).reset
      expect(yield* api.as(manager, (client) => client.orders.export({ query: { search: "SO-3" } }))).toContain("SO-3")
    }),
  )

  it.effect("tells the pages what its settings allow", () =>
    Effect.gen(function* () {
      const api = yield* AppTest.client(SalesApi)
      yield* (yield* TestSettings.for(sales)).set("refundLimit", 250)
      expect(yield* api.as(viewer, (client) => client.orders.options())).toEqual({
        exportsEnabled: true,
        refundLimitCents: 25_000,
      })
      yield* (yield* TestSettings).reset
    }),
  )
})
