import { describe, expect, it } from "vitest"
import { categoryCounts, DEFAULT_CATEGORY, type DirectoryApp, filterApps, groupByCategory, sortApps } from "./filter"

const app = (id: string, changes: Partial<DirectoryApp> = {}): DirectoryApp => ({
  id,
  name: id.toUpperCase(),
  description: undefined,
  category: DEFAULT_CATEGORY,
  available: true,
  activeUsers: 0,
  ...changes,
})

const apps = [
  app("crm", { category: "Sales", description: "Customers and deals", activeUsers: 3 }),
  app("quotes", { category: "Sales", available: false, activeUsers: 9 }),
  app("wiki", { description: "Team knowledge" }),
  app("status", { category: "Operations", activeUsers: 9 }),
]
const ids = (list: ReadonlyArray<DirectoryApp>) => list.map((entry) => entry.id)

describe("filterApps", () => {
  it("matches every word against name, id, category and description", () => {
    expect(ids(filterApps(apps, { query: "sales deal", category: undefined, availableOnly: false }))).toEqual(["crm"])
    expect(ids(filterApps(apps, { query: "", category: "Sales", availableOnly: true }))).toEqual(["crm"])
    expect(filterApps(apps, { query: "  ", category: undefined, availableOnly: false })).toHaveLength(4)
  })
})

describe("sortApps", () => {
  it("sorts by name, or by how many people use the app", () => {
    expect(ids(sortApps(apps, "name"))).toEqual(["crm", "quotes", "status", "wiki"])
    expect(ids(sortApps(apps, "popular"))).toEqual(["quotes", "status", "crm", "wiki"])
  })
})

describe("groupByCategory", () => {
  it("groups by category name, with the default category last", () => {
    expect(groupByCategory(apps).map((group) => [group.category, ids(group.apps)])).toEqual([
      ["Operations", ["status"]],
      ["Sales", ["crm", "quotes"]],
      [DEFAULT_CATEGORY, ["wiki"]],
    ])
    expect(categoryCounts(apps)).toEqual([
      { category: "Operations", count: 1 },
      { category: "Sales", count: 2 },
      { category: DEFAULT_CATEGORY, count: 1 },
    ])
  })
})
