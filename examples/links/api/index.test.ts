import { Schema } from "effect"
import { describe, expect, it } from "vitest"
import { NewLink } from "."

const accepts = (url: string) => Schema.decodeUnknownExit(NewLink)({ title: "A link", url })._tag === "Success"

describe("NewLink", () => {
  it("takes web addresses", () => {
    expect(accepts("https://example.com/a?b=c")).toBe(true)
    expect(accepts("http://intranet/page")).toBe(true)
  })

  it("refuses what a link on the page would run or leave", () => {
    expect(accepts("javascript:alert(1)")).toBe(false)
    expect(accepts("data:text/html,hi")).toBe(false)
    expect(accepts("example.com")).toBe(false)
  })
})
