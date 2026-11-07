import { defineApp, type PortalPage } from "@mosaik/core"
import { describe, expect, it } from "vitest"
import { appPageLinks, currentPage } from "./appPages"

const crm = (pages?: ReadonlyArray<PortalPage<"view" | "deals.edit">>) =>
  defineApp({
    id: "crm",
    name: "CRM",
    access: "view",
    permissions: { view: { description: "" }, "deals.edit": { description: "" } },
    portal: pages === undefined ? {} : { pages },
  })

const app = crm([
  { title: "Overview", path: "/" },
  { title: "Deals", path: "/deals" },
  { title: "Import", path: "/deals/import", permission: "deals.edit" },
])

describe("appPageLinks", () => {
  it("links the app's pages under its address, the first one active on its own address only", () => {
    expect(appPageLinks(app, () => true)).toEqual([
      { label: "Overview", to: "/crm", exact: true },
      { label: "Deals", to: "/crm/deals", exact: false },
      { label: "Import", to: "/crm/deals/import", exact: false },
    ])
  })

  it("leaves out pages for permissions the person lacks", () => {
    const labels = appPageLinks(app, (permission) => permission !== "crm:deals.edit").map((link) => link.label)
    expect(labels).toEqual(["Overview", "Deals"])
  })

  it("lists nothing when one page or none is left", () => {
    expect(appPageLinks(crm([{ title: "Deals", path: "/deals" }]), () => true)).toEqual([])
    expect(appPageLinks(crm(), () => true)).toEqual([])
  })
})

describe("currentPage", () => {
  const links = appPageLinks(app, () => true)
  it("is the listed page open, the longest path that matches, the first page only on its own", () => {
    expect(currentPage(links, "/crm")?.label).toBe("Overview")
    expect(currentPage(links, "/crm/deals")?.label).toBe("Deals")
    expect(currentPage(links, "/crm/deals/42")?.label).toBe("Deals")
    expect(currentPage(links, "/crm/deals/import")?.label).toBe("Import")
    expect(currentPage(links, "/crm/settings")).toBeUndefined()
  })
})
