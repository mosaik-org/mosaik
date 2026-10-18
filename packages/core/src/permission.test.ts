import { describe, expect, it } from "@effect/vitest"
import {
  GrantPattern,
  grantCovers,
  isGranted,
  namespacesGranting,
  PermissionKeyPattern,
  scopeGrants,
} from "./permission"

describe("grantCovers", () => {
  it("matches exact permissions", () => {
    expect(grantCovers("sales:orders.edit", "sales:orders.edit")).toBe(true)
    expect(grantCovers("sales:orders.edit", "sales:orders.refund")).toBe(false)
  })

  it("supports the global wildcard", () => {
    expect(grantCovers("*", "sales:orders.edit")).toBe(true)
    expect(grantCovers("*", "admin:users.manage")).toBe(true)
  })

  it("supports app wildcards without leaking into other apps", () => {
    expect(grantCovers("sales:*", "sales:view")).toBe(true)
    expect(grantCovers("sales:*", "sales:orders.refund")).toBe(true)
    expect(grantCovers("sales:*", "salesforce:view")).toBe(false)
  })

  it("supports segment wildcards", () => {
    expect(grantCovers("sales:orders.*", "sales:orders.edit")).toBe(true)
    expect(grantCovers("sales:orders.*", "sales:orders")).toBe(false)
    expect(grantCovers("sales:orders.*", "sales:ordersx.edit")).toBe(false)
  })
})

describe("isGranted", () => {
  it("is true when any grant covers the permission", () => {
    expect(isGranted(["status:view", "sales:*"], "sales:orders.edit")).toBe(true)
    expect(isGranted(["status:view"], "sales:view")).toBe(false)
    expect(isGranted([], "sales:view")).toBe(false)
  })
})

describe("patterns", () => {
  it("validates permission keys", () => {
    expect(PermissionKeyPattern.test("sales:orders.edit")).toBe(true)
    expect(PermissionKeyPattern.test("sales:*")).toBe(false)
    expect(PermissionKeyPattern.test("Sales:view")).toBe(false)
    expect(PermissionKeyPattern.test("sales:")).toBe(false)
  })

  it("validates grants", () => {
    for (const grant of ["*", "sales:*", "sales:view", "sales:orders.*"]) expect(GrantPattern.test(grant)).toBe(true)
    for (const grant of ["sales", "*:view", "sales:*.edit", "sales:orders*"])
      expect(GrantPattern.test(grant)).toBe(false)
  })
})

describe("scopeGrants", () => {
  it("keeps the namespace's grants and the global wildcard", () => {
    expect(scopeGrants(["*", "sales:view", "sales:orders.*", "admin:access", "salesforce:view"], "sales")).toEqual([
      "*",
      "sales:view",
      "sales:orders.*",
    ])
  })
})

describe("namespacesGranting", () => {
  it("lists the apps where grants cover the permission", () => {
    const owned = namespacesGranting(["sales:access.manage", "crm:*", "hr:access.*", "ops:view"], "access.manage")
    expect(owned).toEqual(new Set(["sales", "crm", "hr"]))
  })

  it("covers every app for the global wildcard", () => {
    expect(namespacesGranting(["sales:view", "*"], "access.manage")).toBe("all")
  })
})
