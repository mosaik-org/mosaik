import { describe, expect, it } from "@effect/vitest"
import { freshnessState } from "./freshness-state"

describe("freshnessState", () => {
  it("is unknown without data", () => expect(freshnessState(undefined, "1 minute")).toBe("unknown"))
  it("is fresh until half of the limit", () => expect(freshnessState(29_000, "1 minute")).toBe("fresh"))
  it("is aging after half of the limit", () => expect(freshnessState(30_000, "1 minute")).toBe("aging"))
  it("is stale after the limit", () => expect(freshnessState(60_000, "1 minute")).toBe("stale"))
})
