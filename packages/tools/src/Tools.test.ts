import { describe, expect, it } from "@effect/vitest"
import { AppTool } from "@mosaik/platform/contract"
import { Result } from "effect"
import { inputSchema, MAX_RESULT_CHARACTERS, toOutcome, toRequest } from "./Tools"

const document = (schema: object, definitions: object = {}) => ({ schema, definitions }) as never

const refund = new AppTool({
  name: "orders.refund",
  title: "Refund an order",
  description: "Refund a paid order",
  examples: [],
  method: "POST",
  path: "/api/shop/orders/:id/refund",
  permission: "shop:orders.refund",
  readOnly: false,
  destructive: true,
  params: document({ type: "object", properties: { id: { type: "string" } }, required: ["id"] }),
  query: null,
  payload: document(
    { $ref: "#/$defs/Refund" },
    { Refund: { type: "object", properties: { reason: { type: "string" } }, required: ["reason"] } },
  ),
})

const search = new AppTool({
  name: "orders.search",
  title: "Find orders",
  description: "Find orders",
  examples: [],
  method: "GET",
  path: "/api/shop/orders",
  permission: "shop:view",
  readOnly: true,
  destructive: false,
  params: null,
  query: document({ type: "object", properties: { text: { type: "string" }, status: { type: "array" } } }),
  payload: null,
})

describe("inputSchema", () => {
  it("groups what the endpoint takes, with their definitions at the root", () => {
    expect(inputSchema(refund)).toEqual({
      type: "object",
      properties: {
        path: {
          type: "object",
          properties: { id: { type: "string" } },
          required: ["id"],
          description: "Path parameters",
        },
        body: { $ref: "#/$defs/Refund", description: "The request body" },
      },
      required: ["path", "body"],
      additionalProperties: false,
      $defs: { Refund: { type: "object", properties: { reason: { type: "string" } }, required: ["reason"] } },
    })
  })

  it("leaves a query without required fields optional", () => {
    expect(inputSchema(search)).toMatchObject({ required: [], properties: { query: { type: "object" } } })
    expect(inputSchema(search)).not.toHaveProperty("$defs")
  })
})

describe("toRequest", () => {
  it("fills in path parameters, encoded, and sends the body as JSON", () => {
    const request = toRequest(refund, { path: { id: "SO 7/1" }, body: { reason: "Damaged" } })
    expect(request).toEqual(
      Result.succeed({ method: "POST", url: "/api/shop/orders/SO%207%2F1/refund", body: '{"reason":"Damaged"}' }),
    )
  })

  it("accepts numbers where the URL needs text", () => {
    expect(Result.getOrThrow(toRequest(refund, { path: { id: 42 }, body: { reason: "x" } })).url).toBe(
      "/api/shop/orders/42/refund",
    )
  })

  it("repeats arrays in the query and leaves out empty values", () => {
    const request = toRequest(search, { query: { text: "acme", status: ["paid", "shipped"], page: null } })
    expect(Result.getOrThrow(request)).toEqual({
      method: "GET",
      url: "/api/shop/orders?text=acme&status=paid&status=shipped",
      body: undefined,
    })
  })

  it("says what is missing instead of calling the app", () => {
    expect(toRequest(refund, { body: { reason: "x" } })).toEqual(Result.fail("Missing path parameters: id"))
    expect(toRequest(refund, { path: { id: "1" } })).toEqual(Result.fail("Missing the request body (`body`)"))
  })
})

describe("toOutcome", () => {
  it("passes the app's answer on, and marks failures", () => {
    expect(toOutcome(200, '{"id":1}')).toEqual({ ok: true, text: '{"id":1}' })
    expect(toOutcome(204, "")).toEqual({ ok: true, text: "Done." })
    expect(toOutcome(403, '{"_tag":"Forbidden"}')).toEqual({
      ok: false,
      text: 'The app answered 403: {"_tag":"Forbidden"}',
    })
  })

  it("cuts long answers, saying so", () => {
    const { text } = toOutcome(200, "x".repeat(MAX_RESULT_CHARACTERS + 10))
    expect(text.startsWith("x".repeat(MAX_RESULT_CHARACTERS))).toBe(true)
    expect(text).toContain(`[Cut after ${MAX_RESULT_CHARACTERS} of ${MAX_RESULT_CHARACTERS + 10} characters`)
  })
})
