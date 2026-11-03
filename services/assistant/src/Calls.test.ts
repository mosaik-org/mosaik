import { describe, expect, it } from "@effect/vitest"
import { Message, type ToolCallPart } from "@mosaik/assistant/contract"
import { AppTool } from "@mosaik/platform/contract"
import { type CatalogTool, inputSchema } from "@mosaik/tools"
import { DateTime, Result } from "effect"
import { describeCall, matchResolutions, modelTools, pendingCalls, stepsSinceQuestion } from "./Calls"

const call = (id: string, fields: Partial<ToolCallPart> = {}): ToolCallPart => ({
  type: "tool-call",
  id,
  tool: "shop_orders_refund",
  input: {},
  title: "Refund",
  app: "shop",
  changes: true,
  destructive: false,
  ...fields,
})
const browserCall = (id: string) => call(id, { tool: "find_pages", changes: false, runsIn: "browser" })

const message = (role: Message["role"], parts: Message["parts"]) =>
  new Message({ id: 1, role, parts, context: null, createdAt: DateTime.makeUnsafe(0) })

describe("pendingCalls", () => {
  it("waits on changes and browser tools until a result is stored, never on reads", () => {
    const read = call("read", { changes: false })
    const messages = [
      message("assistant", [read, call("change"), browserCall("browser"), call("done")]),
      message("tool", [{ type: "tool-result", id: "done", tool: "shop_orders_refund", ok: true, text: "{}" }]),
    ]
    expect(pendingCalls(messages).map((each) => each.id)).toEqual(["change", "browser"])
  })
})

describe("stepsSinceQuestion", () => {
  it("counts the model's replies since the person last wrote", () => {
    const reply = message("assistant", [{ type: "text", text: "…" }])
    const question = message("user", [{ type: "text", text: "?" }])
    expect(stepsSinceQuestion([reply, question, reply, message("tool", []), reply])).toBe(2)
    expect(stepsSinceQuestion([])).toBe(0)
  })
})

describe("matchResolutions", () => {
  const pending = [call("change"), browserCall("browser")]

  it("pairs decisions with changes and results with browser tools", () => {
    const matched = matchResolutions(pending, [
      { type: "decision", call: "change", approve: true },
      { type: "result", call: "browser", ok: true, text: "[]" },
    ])
    expect(Result.getOrThrow(matched).map(([each]) => each.id)).toEqual(["change", "browser"])
  })

  it("says why it cannot", () => {
    const failure = (resolutions: Parameters<typeof matchResolutions>[1]) =>
      Result.match(matchResolutions(pending, resolutions), { onSuccess: () => "", onFailure: (reason) => reason })
    expect(failure([{ type: "decision", call: "other", approve: true }])).toBe("No call other waits to be resolved")
    expect(
      failure([
        { type: "decision", call: "change", approve: true },
        { type: "decision", call: "change", approve: false },
      ]),
    ).toBe("Call change is resolved twice")
    expect(failure([{ type: "decision", call: "browser", approve: true }])).toBe("Call browser runs in the browser")
    expect(failure([{ type: "result", call: "change", ok: true, text: "" }])).toBe(
      "Call change waits for the person's decision",
    )
  })
})

const appTool = (name: string): CatalogTool => {
  const tool = new AppTool({
    name: "orders.search",
    title: "Find orders",
    description: "Finds orders",
    method: "GET",
    path: "/api/shop/orders",
    permission: "shop:view",
    readOnly: true,
    destructive: false,
    params: null,
    query: null,
    payload: null,
  })
  return { name, app: "shop", upstream: new URL("http://shop"), tool, input: inputSchema(tool), fingerprint: name }
}

describe("modelTools", () => {
  it("offers apps' tools and the browser's, which win a clash of names", () => {
    const offered = modelTools([appTool("shop_orders_search"), appTool("find_pages")])
    expect(offered.map((tool) => tool.name)).toEqual(["shop_orders_search", "find_pages", "open_page"])
    expect(offered.find((tool) => tool.name === "open_page")?.input).toMatchObject({
      type: "object",
      properties: { path: { type: "string" } },
      required: ["path"],
    })
  })
})

describe("describeCall", () => {
  it("marks browser tools as running in the browser, changing nothing", () => {
    expect(describeCall({ type: "tool-call", id: "c", tool: "open_page", input: { path: "/" } }, new Map())).toEqual({
      type: "tool-call",
      id: "c",
      tool: "open_page",
      input: { path: "/" },
      title: "Open a page",
      app: "",
      changes: false,
      destructive: false,
      runsIn: "browser",
    })
  })
})
