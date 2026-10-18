import { describe, expect, it } from "@effect/vitest"
import { parseAppList } from "./PlatformConfig"

describe("parseAppList", () => {
  it("parses id=url pairs", () => {
    expect(parseAppList("CONFIGURED_APPS", " admin=http://auth:3000, status=http://localhost:4102 ,")).toEqual([
      { id: "admin", url: "http://auth:3000/" },
      { id: "status", url: "http://localhost:4102/" },
    ])
    expect(parseAppList("CONFIGURED_APPS", "")).toEqual([])
  })

  it("rejects malformed entries, naming the variable", () => {
    expect(() => parseAppList("CONFIGURED_APPS", "sales")).toThrow(/CONFIGURED_APPS/)
    expect(() => parseAppList("CONFIGURED_APPS", "Sales=http://x")).toThrow()
    expect(() => parseAppList("CONFIGURED_APPS", "sales=not a url")).toThrow()
  })
})
