import { describe, expect, it } from "@effect/vitest"
import { appColors, colorOf, defineApp, isApp, toManifestPayload } from "./manifest"
import { expandRoleGrants } from "./roles"

const sales = defineApp({
  id: "sales",
  name: "Sales",
  access: "view",
  permissions: {
    view: { description: "View", defaultRoles: ["authenticated"] },
    "orders.refund": { description: "Refund", dangerous: true },
  },
  notifications: {
    "order.refunded": { description: "An order was refunded", defaultChannels: ["inApp", "email"] },
  },
})

const crm = defineApp({
  id: "crm",
  name: "CRM",
  access: "view",
  permissions: {
    view: { description: "View" },
    "deals.edit": { description: "Edit deals" },
    "deals.delete": { description: "Delete deals" },
    export: { description: "Export" },
  },
  roles: {
    viewer: { name: "Viewer" },
    editor: { name: "Editor", description: "Changes deals", grants: ["deals.*", "export"] },
    admin: { name: "Admin", grants: ["*"] },
  },
})

describe("colorOf", () => {
  it("is the same each time", () => {
    expect(colorOf("ada")).toBe(colorOf("ada"))
  })

  it("uses every colour, for things to be told apart", () => {
    const picked = new Set(Array.from({ length: 200 }, (_, i) => colorOf(`user-${i}`)))
    expect(picked).toEqual(new Set(appColors))
  })
})

describe("defineApp", () => {
  it("derives namespaced permissions and the API prefix", () => {
    expect(sales.perm("orders.refund")).toBe("sales:orders.refund")
    expect(sales.accessPermission).toBe("sales:view")
    expect(sales.apiPrefix).toBe("/api/sales")
    expect(sales.backend).toBe(true)
    expect(sales.database).toBe(false)
    expect(isApp(sales)).toBe(true)
    expect(sales.notification("order.refunded")).toBe("sales:order.refunded")
  })

  it("lets only an action say who resolves it", () => {
    const withNotification = (spec: { action?: boolean; resolvedBy?: "anyone" | "app" }) => () =>
      defineApp({
        id: "x",
        name: "X",
        access: "view",
        permissions: { view: { description: "" } },
        notifications: { "thing.done": { description: "A thing", ...spec } },
      })
    expect(withNotification({ resolvedBy: "app" })).toThrow(/not an action/)
    expect(withNotification({ action: true, resolvedBy: "app" })).not.toThrow()
    expect(withNotification({})).not.toThrow()
  })

  it("rejects invalid or reserved ids", () => {
    expect(() =>
      defineApp({ id: "Sales", name: "x", access: "view", permissions: { view: { description: "" } } }),
    ).toThrow()
    expect(() =>
      defineApp({ id: "auth", name: "x", access: "view", permissions: { view: { description: "" } } }),
    ).toThrow()
  })

  it("rejects invalid notification names", () => {
    expect(() =>
      defineApp({
        id: "x",
        name: "x",
        access: "view",
        permissions: { view: { description: "" } },
        notifications: { "Bad Name": { description: "" } },
      }),
    ).toThrow()
  })

  it("rejects invalid permission names", () => {
    expect(() =>
      defineApp({
        id: "x",
        name: "x",
        access: "view",
        permissions: { view: { description: "" }, "Bad Name": { description: "" } },
      }),
    ).toThrow()
  })
  it("declares statuses with typed keys, and refuses odd names and pages", () => {
    const shop = defineApp({
      id: "shop",
      name: "Shop",
      access: "view",
      permissions: { view: { description: "" } },
      statuses: { "orders.pending": { description: "Orders waiting", kind: "count", page: "/orders" } },
    })
    expect(shop.status("orders.pending")).toBe("shop:orders.pending")
    const withStatus = (name: string, page?: string) => () =>
      defineApp({
        id: "x",
        name: "x",
        access: "view",
        permissions: { view: { description: "" } },
        statuses: { [name]: { description: "", kind: "count", ...(page === undefined ? {} : { page }) } },
      })
    expect(withStatus("Bad Name")).toThrow(/Invalid status name/)
    expect(withStatus("ok", "orders")).toThrow(/Invalid page/)
  })

  it("accepts pages, and refuses ones navigation could not list", () => {
    const withPages = (pages: ReadonlyArray<{ title: string; path: string; permission?: "view" | "edit" }>) => () =>
      defineApp({
        id: "x",
        name: "x",
        access: "view",
        permissions: { view: { description: "" }, edit: { description: "" } },
        portal: { pages },
      })
    expect(
      withPages([
        { title: "Home", path: "/" },
        { title: "Edit", path: "/items/edit", permission: "edit" },
      ]),
    ).not.toThrow()
    expect(withPages([{ title: "Orders", path: "orders" }])).toThrow(/Invalid page path/)
    expect(withPages([{ title: "Orders", path: "/orders/" }])).toThrow(/Invalid page path/)
    expect(
      withPages([
        { title: "A", path: "/a" },
        { title: "B", path: "/a" },
      ]),
    ).toThrow(/listed twice/)
    // A permission the app does not define, as an app built from JSON could have.
    expect(withPages([{ title: "A", path: "/a", permission: "delete" as "edit" }])).toThrow(/does not define/)
  })
})

describe("roles", () => {
  it("include the access permission and expand wildcards, owner last", () => {
    expect(crm.roles.map((role) => [role.id, role.grants])).toEqual([
      ["crm:viewer", ["crm:view"]],
      ["crm:editor", ["crm:deals.delete", "crm:deals.edit", "crm:export", "crm:view"]],
      ["crm:admin", ["crm:deals.delete", "crm:deals.edit", "crm:export", "crm:view"]],
      ["crm:owner", ["crm:access.manage", "crm:view"]],
    ])
    expect(crm.roles[1]?.description).toBe("Changes deals")
  })

  it("default to a member role", () => {
    expect(sales.roles.map((role) => role.id)).toEqual(["sales:member", "sales:owner"])
    expect(sales.roles[0]?.grants).toEqual(["sales:view"])
  })

  it("reject reserved and invalid names", () => {
    const base = { id: "x", name: "x", access: "view", permissions: { view: { description: "" } } } as const
    expect(() => defineApp({ ...base, roles: { owner: { name: "Owner" } } })).toThrow()
    expect(() => defineApp({ ...base, roles: { Bad: { name: "Bad" } } })).toThrow()
    expect(() =>
      defineApp({ ...base, permissions: { view: { description: "" }, "access.manage": { description: "" } } }),
    ).toThrow()
  })

  it("reject wildcards that cover nothing", () => {
    expect(() => expandRoleGrants("x", ["view"], ["orders.*"])).toThrow()
  })
})

describe("toManifestPayload", () => {
  it("serializes permissions with defaults", () => {
    const payload = toManifestPayload(sales)
    expect(payload.access).toBe("sales:view")
    expect(payload.permissions).toEqual([
      expect.objectContaining({ key: "sales:view", dangerous: false, defaultRoles: ["authenticated"] }),
      expect.objectContaining({ key: "sales:orders.refund", dangerous: true, defaultRoles: [] }),
      expect.objectContaining({ key: "sales:access.manage", dangerous: true, defaultRoles: [] }),
    ])
    expect(payload.roles.map((role) => role.id)).toEqual(["sales:member", "sales:owner"])
  })
})
