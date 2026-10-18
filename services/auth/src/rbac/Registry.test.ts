import { describe, expect, it } from "@effect/vitest"
import { defineApp, ManifestRole, toManifestPayload } from "@mosaik/core"
import { grantChanges, manifestProblems } from "./Registry"

const crm = defineApp({
  id: "crm",
  name: "CRM",
  access: "view",
  permissions: { view: { description: "View" }, "deals.edit": { description: "Edit deals" } },
  roles: { viewer: { name: "Viewer" }, editor: { name: "Editor", grants: ["deals.edit"] } },
})

describe("manifestProblems", () => {
  it("accepts manifests built with the SDK", () => {
    expect(manifestProblems(toManifestPayload(crm))).toEqual([])
  })

  it("rejects roles outside the app, undeclared grants and a missing owner role", () => {
    const payload = toManifestPayload(crm)
    const viewer = new ManifestRole({ id: "crm:viewer", name: "Viewer", description: null, grants: ["crm:delete"] })
    const foreign = new ManifestRole({ id: "sales:extra", name: "Extra", description: null, grants: ["crm:view"] })
    const owning = new ManifestRole({ id: "crm:boss", name: "Boss", description: null, grants: ["crm:access.manage"] })
    expect(manifestProblems({ ...payload, roles: [viewer, foreign, owning] })).toEqual([
      "The owner role and permission are missing: rebuild the app with the current SDK",
      "Role crm:viewer grants undeclared permissions (crm:delete)",
      'Role sales:extra must be namespaced with "crm:"',
      "Only the owner role may grant crm:access.manage",
    ])
  })
})

describe("grantChanges", () => {
  it("adds and removes only what differs", () => {
    const changes = grantChanges(
      [
        { id: "crm:viewer", grants: ["crm:view"] },
        { id: "crm:editor", grants: ["crm:deals.edit", "crm:view"] },
      ],
      [
        { roleId: "crm:viewer", grantKey: "crm:view" },
        { roleId: "crm:editor", grantKey: "crm:view" },
        { roleId: "crm:editor", grantKey: "crm:deals.delete" },
      ],
    )
    expect(changes.added).toEqual([{ roleId: "crm:editor", grantKey: "crm:deals.edit" }])
    expect([...changes.removed]).toEqual([["crm:editor", ["crm:deals.delete"]]])
  })

  it("changes nothing when the roles are as declared", () => {
    const changes = grantChanges(
      [{ id: "crm:viewer", grants: ["crm:view"] }],
      [{ roleId: "crm:viewer", grantKey: "crm:view" }],
    )
    expect(changes.added).toEqual([])
    expect(changes.removed.size).toBe(0)
  })
})
