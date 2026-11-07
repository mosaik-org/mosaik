import { describe, expect, it } from "vitest"
import { tabsThatFit } from "./tabsThatFit"

describe("tabsThatFit", () => {
  const widths = [60, 80, 70, 90]
  const options = { more: 70, gap: 4 }

  it("fits all of them when they fit", () => {
    expect(tabsThatFit(widths, 312, options)).toBe(4)
  })

  it("keeps room for More when they do not", () => {
    // 70 (More) + 64 + 84 = 218: two fit; a third would need 292.
    expect(tabsThatFit(widths, 250, options)).toBe(2)
    expect(tabsThatFit(widths, 100, options)).toBe(0)
  })
})
