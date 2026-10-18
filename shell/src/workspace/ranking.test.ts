import { describe, expect, it } from "vitest"
import { affinities, move, recentApps } from "./ranking"

const DAY = 24 * 60 * 60 * 1000
const now = Date.UTC(2026, 9, 17)

describe("affinities", () => {
  it("ranks pinned apps first, then recent and frequent ones", () => {
    const scores = affinities(
      ["crm"],
      [
        { app: "sales", opens: 40, lastOpenedAt: now - DAY },
        { app: "issues", opens: 2, lastOpenedAt: now - DAY },
        { app: "old", opens: 40, lastOpenedAt: now - 60 * DAY },
      ],
      now,
    )
    expect(scores.get("crm")).toBe(1)
    const sales = scores.get("sales") ?? 0
    const issues = scores.get("issues") ?? 0
    const old = scores.get("old") ?? 0
    expect(sales).toBeLessThan(1)
    expect(sales).toBeGreaterThan(issues)
    expect(sales).toBeGreaterThan(old)
    expect(scores.has("never")).toBe(false)
  })

  it("keeps pinned at 1 even when the app is also used", () => {
    expect(affinities(["sales"], [{ app: "sales", opens: 3, lastOpenedAt: now }], now).get("sales")).toBe(1)
  })
})

describe("recentApps", () => {
  it("lists the most recently opened apps, leaving out the excluded ones", () => {
    const usage = [
      { app: "a", opens: 1, lastOpenedAt: now - 3 * DAY },
      { app: "b", opens: 1, lastOpenedAt: now - DAY },
      { app: "c", opens: 1, lastOpenedAt: now - 2 * DAY },
    ]
    expect(recentApps(usage, new Set(["b"]), 5)).toEqual(["c", "a"])
    expect(recentApps(usage, new Set(), 2)).toEqual(["b", "c"])
  })
})

describe("move", () => {
  it("moves an item within the list", () => {
    expect(move(["a", "b", "c"], "c", -1)).toEqual(["a", "c", "b"])
    expect(move(["a", "b", "c"], "a", 1)).toEqual(["b", "a", "c"])
    expect(move(["a", "b", "c"], "a", -1)).toEqual(["a", "b", "c"])
    expect(move(["a", "b"], "x", 1)).toEqual(["a", "b"])
  })
})
