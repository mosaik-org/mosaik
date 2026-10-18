import { describe, expect, it } from "@effect/vitest"
import { Redacted } from "effect"
import { derivedAppKey, generateAppKey, hashAppKey, parseAppKey } from "./keys"

describe("app keys", () => {
  it("name the app they belong to", () => {
    expect(parseAppKey("dak_sales.abc")).toEqual({ appId: "sales", secret: "abc" })
    expect(parseAppKey("dak_order-history.x.y")).toEqual({ appId: "order-history", secret: "x.y" })
    expect(parseAppKey("sales.abc")).toBeUndefined()
    expect(parseAppKey("dak_Sales.abc")).toBeUndefined()
    expect(parseAppKey("dak_sales.")).toBeUndefined()
  })

  it("derives built-in keys per app from the internal key", () => {
    const secret = Redacted.make("internal")
    const sales = Redacted.value(derivedAppKey(secret, "sales"))
    expect(parseAppKey(sales)?.appId).toBe("sales")
    expect(sales).toBe(Redacted.value(derivedAppKey(secret, "sales")))
    expect(sales).not.toBe(Redacted.value(derivedAppKey(secret, "status")))
    expect(sales).not.toBe(Redacted.value(derivedAppKey(Redacted.make("other"), "sales")))
  })

  it("generates random keys stored only as a hash", () => {
    const { key, hash } = generateAppKey("crm")
    expect(parseAppKey(Redacted.value(key))?.appId).toBe("crm")
    expect(hash).toBe(hashAppKey(Redacted.value(key)))
    expect(hash).not.toContain(Redacted.value(key))
  })
})
