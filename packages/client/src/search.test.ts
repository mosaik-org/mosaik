import { describe, expect, it } from "@effect/vitest"
import { Schema } from "effect"
import { searchValidator } from "./search"

const Search = Schema.Struct({
  page: Schema.optional(Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))),
  status: Schema.optional(Schema.Literals(["open", "closed"])),
  q: Schema.optional(Schema.String),
})

const validate = (raw: unknown) => searchValidator(Search)["~standard"].validate(raw).value

describe("searchValidator", () => {
  it("keeps valid params", () => {
    expect(validate({ page: 2, status: "open", q: "acme" })).toEqual({ page: 2, status: "open", q: "acme" })
  })

  it("drops invalid params instead of failing", () => {
    expect(validate({ page: -1, status: "unknown", q: "acme" })).toEqual({ q: "acme" })
  })

  it("ignores unknown params", () => {
    expect(validate({ page: 1, other: "x" })).toEqual({ page: 1 })
  })

  it("accepts numeric text for string params (the router parses `?q=123` as a number)", () => {
    expect(validate({ q: 123 })).toEqual({ q: "123" })
  })
})
