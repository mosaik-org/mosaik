import { describe, expect, it } from "@effect/vitest"
import { bestScore, fuzzyScore } from "./fuzzy"

describe("fuzzyScore", () => {
  it("matches subsequences and rejects missing characters", () => {
    expect(fuzzyScore("ord", "Orders")).not.toBeNull()
    expect(fuzzyScore("odr", "Orders")).not.toBeNull()
    expect(fuzzyScore("xyz", "Orders")).toBeNull()
  })

  it("ranks consecutive and word-start matches higher", () => {
    const prefix = fuzzyScore("aud", "Audit log") ?? 0
    const scattered = fuzzyScore("aud", "Add user dialog") ?? 0
    expect(prefix).toBeGreaterThan(scattered)
  })

  it("ignores case and spaces", () => {
    expect(fuzzyScore("sales ov", "Sales overview")).not.toBeNull()
  })

  it("uses the best of several texts", () => {
    expect(bestScore("kpi", ["Sales overview", "revenue kpi"])).not.toBeNull()
    expect(bestScore("kpi", ["Sales overview"])).toBeNull()
  })
})
