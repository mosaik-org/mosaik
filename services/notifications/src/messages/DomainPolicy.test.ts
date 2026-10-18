import { describe, expect, it } from "@effect/vitest"
import { DomainPolicy } from "./DomainPolicy"

describe("DomainPolicy", () => {
  it("allows no external addresses when empty", () => {
    expect(DomainPolicy.parse("").allows("a@example.com")).toBe(false)
    expect(DomainPolicy.parse(" , ").allows("a@example.com")).toBe(false)
  })

  it("allows any address with *", () => {
    expect(DomainPolicy.parse("*").allows("a@anything.org")).toBe(true)
  })

  it("matches exact domains case-insensitively", () => {
    const policy = DomainPolicy.parse("Example.com, partner.io")
    expect(policy.allows("a@example.com")).toBe(true)
    expect(policy.allows("a@EXAMPLE.COM")).toBe(true)
    expect(policy.allows("a@partner.io")).toBe(true)
    expect(policy.allows("a@mail.example.com")).toBe(false)
    expect(policy.allows("a@notexample.com")).toBe(false)
  })

  it("matches subdomains with *.", () => {
    const policy = DomainPolicy.parse("*.partner.com")
    expect(policy.allows("a@eu.partner.com")).toBe(true)
    expect(policy.allows("a@partner.com")).toBe(false)
    expect(policy.allows("a@evilpartner.com")).toBe(false)
  })

  it("uses the domain after the last @", () => {
    expect(DomainPolicy.parse("example.com").allows('"x@evil.com"@example.com')).toBe(true)
    expect(DomainPolicy.parse("example.com").allows("x@example.com@evil.com")).toBe(false)
  })
})
