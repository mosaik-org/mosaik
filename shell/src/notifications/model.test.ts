import { InboxItem, Resolution } from "@mosaik/notifications/contract"
import { DateTime } from "effect"
import { describe, expect, it } from "vitest"
import { createArrivals, inListOrder, paragraphs, sectionsOf, statusOf, viewOf } from "./model"

const now = new Date(2026, 10, 8, 15, 0).getTime()
const HOUR = 60 * 60 * 1000

const item = (overrides: Partial<ConstructorParameters<typeof InboxItem>[0]> & { readonly id: number }) =>
  new InboxItem({
    type: "desk:request.overdue",
    source: "desk",
    subject: null,
    content: { title: `Item ${overrides.id}` },
    action: true,
    resolvable: true,
    state: "open",
    updates: 1,
    createdAt: DateTime.makeUnsafe(now - HOUR),
    updatedAt: DateTime.makeUnsafe(now - HOUR),
    readAt: null,
    snoozedUntil: null,
    resolution: null,
    ...overrides,
  })

describe("viewOf", () => {
  it("lists open items by kind, the others by state", () => {
    expect(viewOf(item({ id: 1 }))).toBe("todo")
    expect(viewOf(item({ id: 2, action: false }))).toBe("updates")
    expect(viewOf(item({ id: 3, state: "snoozed" }))).toBe("snoozed")
    expect(viewOf(item({ id: 4, state: "resolved", action: false }))).toBe("resolved")
  })
})

describe("sectionsOf", () => {
  it("puts critical items first, then the rest by day", () => {
    const today = item({ id: 1 })
    const yesterday = item({ id: 2, updatedAt: DateTime.makeUnsafe(now - 24 * HOUR) })
    const critical = item({
      id: 3,
      updatedAt: DateTime.makeUnsafe(now - 48 * HOUR),
      content: { title: "Down", severity: "critical" },
    })
    const sections = sectionsOf([today, yesterday, critical], "day", now)
    expect(sections.map((section) => section.heading)).toEqual(["Critical", "Today", "Yesterday"])
    expect(inListOrder(sections).map((found) => found.id)).toEqual([3, 1, 2])
  })

  it("does not lift a critical item out once it is handled", () => {
    const resolved = item({ id: 1, state: "resolved", content: { title: "Down", severity: "critical" } })
    expect(sectionsOf([resolved], "day", now).map((section) => section.heading)).toEqual(["Today"])
  })

  it("splits by kind, without empty sections", () => {
    const sections = sectionsOf([item({ id: 1, action: false }), item({ id: 2 })], "kind", now)
    expect(sections.map((section) => [section.heading, section.items.map((found) => found.id)])).toEqual([
      ["To do", [2]],
      ["For your information", [1]],
    ])
    expect(sectionsOf([item({ id: 1 })], "kind", now).map((section) => section.heading)).toEqual(["To do"])
  })
})

describe("statusOf", () => {
  it("says who resolved it", () => {
    const at = DateTime.makeUnsafe(now)
    const byApp = new Resolution({ at, by: { id: "u1" as never, name: "Ada" }, app: true })
    expect(statusOf(item({ id: 1, state: "resolved", resolution: byApp }), "Service Desk", now)).toBe("Resolved by Ada")
    const anonymous = new Resolution({ at, by: null, app: true })
    expect(statusOf(item({ id: 2, state: "resolved", resolution: anonymous }), "Service Desk", now)).toBe(
      "Resolved in Service Desk",
    )
    const mine = new Resolution({ at, by: null, app: false })
    expect(statusOf(item({ id: 3, state: "resolved", resolution: mine, action: false }), "Sales", now)).toBe("Done")
  })

  it("says nothing of an open item", () => {
    expect(statusOf(item({ id: 1 }), "Sales", now)).toBeUndefined()
  })
})

describe("paragraphs", () => {
  it("splits on blank lines and drops empty ones", () => {
    expect(paragraphs("One\nstill one\n\n  \n\nTwo\n")).toEqual(["One\nstill one", "Two"])
    expect(paragraphs(undefined)).toEqual([])
  })
})

describe("createArrivals", () => {
  it("marks what came after the list was shown, once", () => {
    const arrivals = createArrivals(now)
    const old = item({ id: 1 })
    expect(arrivals([old])).toEqual(new Set())
    const fresh = item({ id: 2, updatedAt: DateTime.makeUnsafe(now + 1000) })
    expect(arrivals([fresh, old])).toEqual(new Set([2]))
    expect(arrivals([fresh, old])).toEqual(new Set())
  })

  it("marks an item again when a later notification updates it", () => {
    const arrivals = createArrivals(now)
    arrivals([item({ id: 1, updatedAt: DateTime.makeUnsafe(now + 1000) })])
    expect(arrivals([item({ id: 1, updatedAt: DateTime.makeUnsafe(now + 2000) })])).toEqual(new Set([1]))
  })

  it("does not mark an older page loaded later", () => {
    const arrivals = createArrivals(now)
    expect(arrivals([item({ id: 9, updatedAt: DateTime.makeUnsafe(now - 72 * HOUR) })])).toEqual(new Set())
  })
})
