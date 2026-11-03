import { PersonStatus } from "@mosaik/platform/contract"
import { DateTime } from "effect"
import { describe, expect, it } from "vitest"
import { fromBusy, isCurrent, linkTarget, type ShownStatus, statusesAt, summarize } from "./model"

const shown = (path: string, value: ShownStatus["value"], tone: ShownStatus["tone"] = "attention"): ShownStatus => ({
  key: `${path}:${value._tag}`,
  description: "Orders waiting for approval",
  path,
  link: path,
  tone,
  value,
})
const count = (path: string, n: number) => shown(path, { _tag: "count", count: n })

describe("statusesAt", () => {
  it("takes a place's own, and the ones under it when asked", () => {
    const statuses = [count("/sales", 1), count("/sales/orders", 2), count("/salesforce", 4)]
    expect(statusesAt(statuses, "/sales", { below: false }).map((s) => s.path)).toEqual(["/sales"])
    expect(statusesAt(statuses, "/sales", { below: true }).map((s) => s.path)).toEqual(["/sales", "/sales/orders"])
  })
})

describe("summarize", () => {
  it("adds up counts, notes work and news, and keeps the strongest tone", () => {
    const summary = summarize([
      count("/sales/orders", 2),
      count("/sales", 1),
      shown("/sales", { _tag: "health", level: "danger", label: "The bank does not answer" }, "danger"),
      fromBusy({ id: 1, label: "Exporting orders", path: "/sales/orders", keepOpen: false }),
    ])
    expect(summary).toMatchObject({ count: 3, running: true, fresh: false, tone: "danger" })
    expect(summary.lines).toEqual([
      "Orders waiting for approval: 2",
      "Orders waiting for approval: 1",
      "The bank does not answer",
      "Exporting orders",
    ])
  })
})

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
