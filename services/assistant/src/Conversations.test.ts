import { describe, expect, it } from "@effect/vitest"
import { cleanTitle, titleOf } from "./Conversations"

describe("titleOf", () => {
  it("is the first line, shortened", () => {
    expect(titleOf("Biggest orders?\nThis month")).toBe("Biggest orders?")
    expect(titleOf("x".repeat(80))).toBe(`${"x".repeat(57)}…`)
  })
})

describe("cleanTitle", () => {
  it("keeps one line, without quotes, Markdown or a final period", () => {
    expect(cleanTitle('"Biggest orders this month."')).toBe("Biggest orders this month")
    expect(cleanTitle("**Refund for Initech**\nmore")).toBe("Refund for Initech")
    expect(cleanTitle("  \n")).toBeUndefined()
  })
})
