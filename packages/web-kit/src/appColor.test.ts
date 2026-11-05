import { appColors } from "@mosaik/core"
import { describe, expect, it } from "vitest"
import { appColor } from "./appColor"

describe("appColor", () => {
  it("is the one the manifest names", () => {
    expect(appColor({ id: "sales", portal: { color: "teal" } })).toBe("teal")
  })

  it("is picked from the id otherwise, the same each time", () => {
    const picked = appColor({ id: "sales", portal: {} })
    expect(appColors).toContain(picked)
    expect(appColor({ id: "sales", portal: {} })).toBe(picked)
  })

  it("tells most apps apart", () => {
    const ids = ["sales", "issues", "notes", "status", "admin", "portal", "billing", "hr"]
    expect(new Set(ids.map((id) => appColor({ id, portal: {} }))).size).toBeGreaterThanOrEqual(4)
  })
})
