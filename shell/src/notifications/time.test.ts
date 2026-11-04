import { describe, expect, it } from "vitest"
import { groupByDay, shortAgo } from "./time"

const now = new Date(2026, 10, 4, 15, 0).getTime()
const hours = (h: number) => now - h * 60 * 60 * 1000

describe("groupByDay", () => {
  it("puts items in runs by day, keeping their order", () => {
    const items = [hours(1), hours(10), hours(20), hours(60), hours(24 * 30)]
    expect(groupByDay(items, (ms) => ms, now).map((group) => [group.day, group.items.length])).toEqual([
      ["Today", 2],
      ["Yesterday", 1],
      ["Last 7 days", 1],
      ["Earlier", 1],
    ])
  })

  it("has no groups for no items", () => {
    expect(groupByDay([], (ms: number) => ms, now)).toEqual([])
  })
})

describe("shortAgo", () => {
  it("says how long ago in a few characters", () => {
    expect(shortAgo(now - 20_000, now)).toBe("now")
    expect(shortAgo(now - 12 * 60_000, now)).toBe("12m")
    expect(shortAgo(hours(4), now)).toBe("4h")
    expect(shortAgo(hours(72), now)).toBe("3d")
  })

  it("gives the date for older ones", () => {
    expect(shortAgo(hours(24 * 20), now, "en-US")).toBe("Oct 15")
  })
})
