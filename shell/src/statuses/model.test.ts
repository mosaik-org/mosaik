import { PersonStatus } from "@mosaik/platform/contract"
import { DateTime } from "effect"
import { describe, expect, it } from "vitest"
import { isCurrent, linkTarget } from "./model"

describe("isCurrent", () => {
  const news = (at: string) =>
    new PersonStatus({
      key: "sales:news",
      app: "sales",
      description: "New orders",
      kind: "new",
      tone: "attention",
      path: "/sales",
      link: "/sales",
      value: { _tag: "new", at: DateTime.makeUnsafe(at) },
      updatedAt: DateTime.makeUnsafe(at),
    })
  it("keeps something new only until the person opens the app after it came", () => {
    const opened = Date.parse("2026-11-03T10:00:00Z")
    expect(isCurrent(news("2026-11-03T11:00:00Z"), () => opened)).toBe(true)
    expect(isCurrent(news("2026-11-03T09:00:00Z"), () => opened)).toBe(false)
    expect(isCurrent(news("2026-11-03T09:00:00Z"), () => undefined)).toBe(true)
  })
})

describe("linkTarget", () => {
  it("splits a link into the router's path and search", () => {
    expect(linkTarget("/sales/orders?status=pending")).toEqual({ to: "/sales/orders", search: { status: "pending" } })
    expect(linkTarget("/assistant/abc")).toEqual({ to: "/assistant/abc", search: {} })
  })
})
