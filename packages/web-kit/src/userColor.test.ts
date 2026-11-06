import { appColors } from "@mosaik/core"
import { describe, expect, it } from "vitest"
import { userColor } from "./userColor"

describe("userColor", () => {
  it("is the same each time", () => {
    expect(userColor("ada")).toBe(userColor("ada"))
  })

  it("uses every colour, for people to be told apart", () => {
    const picked = new Set(Array.from({ length: 200 }, (_, i) => userColor(`user-${i}`)))
    expect(picked).toEqual(new Set(appColors))
  })
})
