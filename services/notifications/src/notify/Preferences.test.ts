import { describe, expect, it } from "@effect/vitest"
import { effectiveSettings, isEnabled } from "./Preferences"

describe("isEnabled", () => {
  it("uses the user's choice, else the type's defaults", () => {
    expect(isEnabled(["inApp"], {}, "inApp")).toBe(true)
    expect(isEnabled(["inApp"], {}, "email")).toBe(false)
    expect(isEnabled(["inApp"], { inApp: false }, "inApp")).toBe(false)
    expect(isEnabled(["inApp"], { email: true }, "email")).toBe(true)
  })

  it("resolves every channel", () => {
    expect(effectiveSettings(["inApp", "email"], { email: false, slack: true })).toEqual({
      inApp: true,
      email: false,
      slack: true,
    })
  })
})
