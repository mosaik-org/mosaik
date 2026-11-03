import { describe, expect, it } from "vitest"
import type { Place, ToolCallPart } from "../contract"
import type { AssistantBrowser } from "./browser"
import { isLocalPath, PLACES_LIMIT, runBrowserCall } from "./browserCalls"

const call = (tool: string, input: unknown): ToolCallPart => ({
  type: "tool-call",
  id: "c1",
  tool,
  input: input as never,
  title: tool,
  app: "",
  changes: false,
  destructive: false,
  runsIn: "browser",
})

const place = (index: number): Place => ({
  title: `Order ${index}`,
  group: "Orders",
  path: `/sales/orders?search=${index}`,
})

const browser = (places: ReadonlyArray<Place>): AssistantBrowser & { readonly searched: Array<string> } => {
  const searched: Array<string> = []
  return {
    searched,
    findPlaces: async (query) => {
      searched.push(query)
      return places
    },
    openPage: () => {},
  }
}

describe("runBrowserCall", () => {
  it("finds places through the frame, at most a few, as JSON for the model", async () => {
    const frame = browser(Array.from({ length: PLACES_LIMIT + 5 }, (_, index) => place(index)))
    const { resolution, navigateTo } = await runBrowserCall(call("find_pages", { query: "orders" }), frame)
    expect(frame.searched).toEqual(["orders"])
    expect(resolution).toMatchObject({ type: "result", call: "c1", ok: true })
    expect(JSON.parse(resolution.text)).toHaveLength(PLACES_LIMIT)
    expect(navigateTo).toBeUndefined()
  })

  it("says when nothing was found, and when the input is wrong", async () => {
    expect((await runBrowserCall(call("find_pages", { query: "zz" }), browser([]))).resolution.text).toBe(
      "Nothing found for “zz”.",
    )
    const wrong = await runBrowserCall(call("find_pages", { query: 1 }), browser([]))
    expect(wrong.resolution.ok).toBe(false)
    expect(wrong.resolution.text).toMatch(/^Invalid input/)
  })

  it("opens pages of Mosaik only, once the turn is over", async () => {
    const opened = await runBrowserCall(call("open_page", { path: "/sales/orders", title: "Orders" }), browser([]))
    expect(opened).toEqual({
      resolution: { type: "result", call: "c1", ok: true, text: "Opened Orders." },
      navigateTo: "/sales/orders",
    })
    const away = await runBrowserCall(call("open_page", { path: "//evil.example/x" }), browser([]))
    expect(away).toEqual({
      resolution: { type: "result", call: "c1", ok: false, text: "//evil.example/x is not a page of Mosaik" },
    })
  })

  it("fails, saying why, without a frame or for a tool the browser does not run", async () => {
    expect((await runBrowserCall(call("find_pages", { query: "orders" }), undefined)).resolution.ok).toBe(false)
    expect((await runBrowserCall(call("shop_orders_refund", {}), browser([]))).resolution).toMatchObject({
      ok: false,
      text: "shop_orders_refund is not a browser tool",
    })
  })
})

describe("isLocalPath", () => {
  it("is a path on this site", () => {
    expect(isLocalPath("/sales")).toBe(true)
    expect(isLocalPath("//evil.example")).toBe(false)
    expect(isLocalPath("https://evil.example")).toBe(false)
    expect(isLocalPath("javascript:alert(1)")).toBe(false)
  })
})
