import { describe, expect, it } from "@effect/vitest"
import { Duration } from "effect"
import { retryDelay } from "./Backoff"

describe("retryDelay", () => {
  it("doubles from 30 seconds and caps at one hour", () => {
    expect([1, 2, 3, 4, 8, 20].map((attempts) => Duration.toSeconds(retryDelay(attempts)))).toEqual([
      30, 60, 120, 240, 3600, 3600,
    ])
  })
})
