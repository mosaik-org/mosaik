import type { PageStatus } from "@mosaik/client"
import { describe, expect, it } from "vitest"
import { statusesAt, summarize } from "./statusSummary"

const shown = (path: string, value: PageStatus["value"], tone: PageStatus["tone"] = "attention"): PageStatus => ({
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
      shown("/sales/orders", { _tag: "running", progress: null, label: "Exporting orders" }),
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
