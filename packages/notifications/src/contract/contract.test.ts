import { describe, expect, it } from "@effect/vitest"
import { Schema } from "effect"
import { Content } from "./content"
import { Destination } from "./destination"
import { MessageRequest, NotificationTypeInput } from "./internal"

const isContent = Schema.is(Content)
const isDestination = Schema.is(Destination)

describe("Content", () => {
  it("accepts app paths and http(s) links only", () => {
    expect(isContent({ title: "x", link: "/sales/orders/1" })).toBe(true)
    expect(isContent({ title: "x", link: "https://example.com/a?b=c" })).toBe(true)
    expect(isContent({ title: "x", link: "javascript:alert(1)" })).toBe(false)
    expect(isContent({ title: "x", link: "//evil.com" })).toBe(false)
    expect(isContent({ title: "x", link: "/\\evil.com" })).toBe(false)
  })

  it("requires a single-line, non-empty title", () => {
    expect(isContent({ title: "" })).toBe(false)
    expect(isContent({ title: "Hello\nBcc: x@evil.com" })).toBe(false)
  })
})

describe("Destination", () => {
  it("validates e-mail addresses and names", () => {
    expect(isDestination({ _tag: "Email", address: "a.b+c@example.co.uk" })).toBe(true)
    expect(isDestination({ _tag: "Email", address: "not-an-address" })).toBe(false)
    expect(isDestination({ _tag: "Email", address: "a@b.com>, c@d.com" })).toBe(false)
    expect(isDestination({ _tag: "Email", address: "a@b.com", name: "Eve\r\nBcc: x@y.z" })).toBe(false)
  })
})

describe("MessageRequest", () => {
  const decode = Schema.decodeUnknownSync(MessageRequest)
  const base = { source: "sales", kind: null, content: { title: "x" }, idempotencyKey: null }

  it("allows routed messages without destinations (the service checks there is a kind)", () => {
    expect(decode({ ...base, to: [] }).to).toHaveLength(0)
  })

  it("limits the number of destinations", () => {
    const to = Array.from({ length: 51 }, (_, i) => ({ _tag: "Email", address: `a${i}@b.com` }))
    expect(() => decode({ ...base, to })).toThrow()
  })

  it("accepts targets", () => {
    expect(decode({ ...base, to: [{ _tag: "Target", targetId: "ops-alerts" }] }).to).toHaveLength(1)
    expect(() => decode({ ...base, to: [{ _tag: "Target", targetId: "Ops Alerts" }] })).toThrow()
  })
})

describe("NotificationTypeInput", () => {
  const decode = Schema.decodeUnknownSync(NotificationTypeInput)

  it("reads a type registered before actions as information anyone may clear", () => {
    const stored = { key: "sales:order.refunded", description: "Refunded", defaultChannels: ["inApp"] }
    expect(decode(stored)).toMatchObject({ action: false, resolvedBy: "anyone" })
    expect(decode({ ...stored, action: true, resolvedBy: "app" })).toMatchObject({ action: true, resolvedBy: "app" })
  })
})
