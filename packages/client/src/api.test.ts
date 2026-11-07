import { describe, expect, it } from "@effect/vitest"
import { provideToaster, type Toast } from "@mosaik/client"
import { NotFound } from "@mosaik/core"
import { QueryClient, QueryClientProvider } from "@tanstack/solid-query"
import { Schema } from "effect"
import { HttpApi, HttpApiEndpoint, HttpApiGroup } from "effect/http-api"
import { createComponent, createRoot } from "solid-js"
import { vi } from "vitest"
import { type Action, type ActionOptions, createApi, useAction } from "./api"

// The toasts the actions show, through the shell's contract.
const shown: Array<Toast> = []
provideToaster({ show: (toast) => shown.push(toast) })

class Order extends Schema.Class<Order>("Order")({ id: Schema.Number, number: Schema.String }) {}

const SalesApi = HttpApi.make("sales").add(
  HttpApiGroup.make("orders").add(
    HttpApiEndpoint.get("list", "/orders", {
      query: { page: Schema.optional(Schema.NumberFromString) },
      success: Schema.Array(Order),
    }),
    HttpApiEndpoint.post("refund", "/orders/:id/refund", {
      params: { id: Schema.NumberFromString },
      success: Order,
      error: NotFound,
    }),
  ),
)

const sales = createApi(SalesApi)

describe("createApi", () => {
  it("keys queries by the contract: API, group, endpoint, request", () => {
    expect(sales.key()).toEqual(["sales"])
    expect(sales.orders.key()).toEqual(["sales", "orders"])
    expect(sales.orders.list.key()).toEqual(["sales", "orders", "list"])
    expect(sales.orders.list.query({ query: { page: 2 } }).queryKey).toEqual([
      "sales",
      "orders",
      "list",
      { query: { page: 2 } },
    ])
  })
})

type Refund = typeof sales.orders.refund

/** `useAction` in a component with a query client, for the refund endpoint with a fake call. */
type RefundAction = Action<Order, Parameters<Refund["call"]>>

const withAction = (call: () => Promise<Order>, options: ActionOptions<Order, Parameters<Refund["call"]>>) => {
  const queryClient = new QueryClient()
  const invalidated: Array<unknown> = []
  vi.spyOn(queryClient, "invalidateQueries").mockImplementation(async (filters) => {
    invalidated.push(filters?.queryKey)
  })
  const endpoint: Refund = { ...sales.orders.refund, call }
  let action: RefundAction | undefined
  createRoot(() =>
    createComponent(QueryClientProvider, {
      client: queryClient,
      get children() {
        action = useAction(endpoint, options)
        return null
      },
    }),
  )
  if (action === undefined) throw new Error("useAction did not run")
  return { action, invalidated }
}

describe("useAction", () => {
  it("toasts the outcome and refetches what it affects", async () => {
    shown.length = 0
    const order = new Order({ id: 7, number: "SO-7" })
    const { action, invalidated } = withAction(() => Promise.resolve(order), {
      success: (value) => `${value.number} was refunded`,
      invalidates: [{ key: () => ["sales", "orders"] }],
    })
    expect(await action.run({ params: { id: 7 } })).toBe(true)
    expect(shown).toEqual([{ type: "success", title: "SO-7 was refunded" }])
    expect(invalidated).toEqual([["sales", "orders"]])
    expect(action.pending()).toBe(false)
  })

  it("run shows a failure as a toast; submit throws it for a form", async () => {
    shown.length = 0
    const { action } = withAction(() => Promise.reject(new NotFound({ resource: "order", id: "7" })), {
      failure: "Could not refund",
    })
    expect(await action.run({ params: { id: 7 } })).toBe(false)
    expect(shown).toEqual([{ type: "error", title: "Could not refund", description: expect.any(String) }])
    await expect(action.submit({ params: { id: 7 } })).rejects.toBeInstanceOf(NotFound)
    expect(shown).toHaveLength(1)
  })
})
