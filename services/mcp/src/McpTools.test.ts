import { describe, expect, it } from "@effect/vitest"
import { AppTool } from "@mosaik/platform/contract"
import { type CatalogTool, inputSchema } from "@mosaik/tools"
import { toCallToolResult, toMcpTool } from "./McpTools"

const catalogTool = (tool: AppTool): CatalogTool => ({
  name: `shop_${tool.name.replace(".", "_")}`,
  app: "shop",
  upstream: new URL("http://shop:3000"),
  tool,
  input: inputSchema(tool),
  fingerprint: tool.name,
})

const tool = (fields: Pick<AppTool, "name" | "method" | "readOnly" | "destructive">) =>
  catalogTool(
    new AppTool({
      ...fields,
      title: fields.name,
      description: "",
      path: "/api/shop/orders",
      permission: "shop:view",
      params: null,
      query: null,
      payload: null,
    }),
  )

describe("toMcpTool", () => {
  it("tells clients what the tool changes", () => {
    const refund = tool({ name: "orders.refund", method: "POST", readOnly: false, destructive: true })
    const search = tool({ name: "orders.search", method: "GET", readOnly: true, destructive: false })
    expect(toMcpTool(refund).annotations).toMatchObject({
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: false,
    })
    expect(toMcpTool(search)).toMatchObject({
      name: "shop_orders_search",
      annotations: { readOnlyHint: true, destructiveHint: false },
    })
  })
})

describe("toCallToolResult", () => {
  it("marks failed calls as errors", () => {
    expect(toCallToolResult({ ok: true, text: "{}" })).toMatchObject({ content: [{ type: "text", text: "{}" }] })
    expect(toCallToolResult({ ok: true, text: "{}" }).isError).toBeUndefined()
    expect(toCallToolResult({ ok: false, text: "No" })).toMatchObject({ isError: true })
  })
})
