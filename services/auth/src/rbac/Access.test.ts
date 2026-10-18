import { describe, expect, it } from "@effect/vitest"
import { rolesGranting } from "./Access"

describe("rolesGranting", () => {
  const grants = [
    { roleId: "superadmin", grantKey: "*" },
    { roleId: "sales-team", grantKey: "sales:*" },
    { roleId: "support", grantKey: "sales:orders.*" },
    { roleId: "viewer", grantKey: "sales:view" },
    { roleId: "ops", grantKey: "status:view" },
  ]

  it("matches exact grants and wildcards", () => {
    expect([...rolesGranting(grants, "sales:orders.refund")].sort()).toEqual(["sales-team", "superadmin", "support"])
    expect([...rolesGranting(grants, "sales:view")].sort()).toEqual(["sales-team", "superadmin", "viewer"])
    expect([...rolesGranting(grants, "issues:view")]).toEqual(["superadmin"])
  })

  it("only counts grants in the permission's app when explicit", () => {
    expect([...rolesGranting(grants, "sales:orders.refund", true)].sort()).toEqual(["sales-team", "support"])
    expect([...rolesGranting(grants, "issues:view", true)]).toEqual([])
  })
})
