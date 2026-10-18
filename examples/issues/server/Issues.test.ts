import { describe, expect, it } from "@effect/vitest"
import { toJql } from "./Issues"

describe("toJql", () => {
  it("defaults to open issues", () => {
    expect(toJql({})).toBe("statusCategory != Done ORDER BY updated DESC")
  })

  it("combines filters", () => {
    expect(toJql({ project: "OPS", category: "in-progress", q: "deploy" })).toBe(
      'project = "OPS" AND statusCategory = "In Progress" AND text ~ "deploy" ORDER BY updated DESC',
    )
  })

  it("looks up issue keys directly", () => {
    expect(toJql({ q: "ops-101" })).toBe('key = "OPS-101" ORDER BY updated DESC')
  })

  it("quotes user input so it cannot change the query", () => {
    expect(toJql({ q: 'x" OR project = SECRET OR text ~ "y' })).toBe(
      'statusCategory != Done AND text ~ "x\\" OR project = SECRET OR text ~ \\"y" ORDER BY updated DESC',
    )
  })
})
