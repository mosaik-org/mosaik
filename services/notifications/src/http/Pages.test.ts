import { describe, expect, it } from "vitest"
import { timeAgo } from "./Pages"

const now = Date.UTC(2026, 10, 7, 12, 0)
const ago = (minutes: number) => timeAgo(now - minutes * 60_000, now)

describe("timeAgo", () => {
  it("says how long ago, as near as it matters", () => {
    expect(ago(0)).toBe("just now")
    expect(ago(1)).toBe("1 minute ago")
    expect(ago(45)).toBe("45 minutes ago")
    expect(ago(60)).toBe("1 hour ago")
    expect(ago(150)).toBe("3 hours ago")
    expect(ago(60 * 24 * 3)).toBe("3 days ago")
  })
})
