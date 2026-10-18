import { describe, expect, it } from "vitest"
import { SEARCH_ALL_LIMIT, sourcesToSearch } from "./scope"
import type { SearchSource } from "./types"

const source = (app: string): SearchSource => ({ app, load: () => Promise.reject(new Error("not loaded")) })
const many = Array.from({ length: SEARCH_ALL_LIMIT + 2 }, (_, index) => source(`app-${index}`))
const used = new Set(["app-1", "app-4"])
const affinity = (app: string) => (used.has(app) ? 0.5 : 0)

describe("sourcesToSearch", () => {
  it("searches every app when there are only a few", () => {
    const few = many.slice(0, SEARCH_ALL_LIMIT)
    expect(sourcesToSearch(few, { app: undefined, everything: false, affinity })).toEqual({ searched: few, skipped: 0 })
  })

  it("searches only the apps the user uses when there are many", () => {
    const { searched, skipped } = sourcesToSearch(many, { app: undefined, everything: false, affinity })
    expect(searched.map((entry) => entry.app)).toEqual(["app-1", "app-4"])
    expect(skipped).toBe(many.length - 2)
  })

  it("searches everything on request, and one app when scoped", () => {
    expect(sourcesToSearch(many, { app: undefined, everything: true, affinity }).searched).toHaveLength(many.length)
    const scoped = sourcesToSearch(many, { app: "app-7", everything: true, affinity })
    expect(scoped.searched.map((entry) => entry.app)).toEqual(["app-7"])
    expect(scoped.skipped).toBe(0)
  })
})
