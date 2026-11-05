import { describe, expect, it } from "@effect/vitest"
import { ManifestPermission } from "@mosaik/core"
import { AppManifest, PLATFORM_MAJOR, PortalManifest } from "@mosaik/platform/contract"
import { manifestProblems } from "./Installer"

const manifest = (changes: Partial<ConstructorParameters<typeof AppManifest>[0]> = {}) =>
  new AppManifest({
    id: "crm",
    name: "CRM",
    description: null,
    version: "1.0.0",
    platform: PLATFORM_MAJOR,
    access: "crm:view",
    permissions: [],
    roles: [],
    notifications: [],
    events: [],
    database: false,
    storage: false,
    settings: [],
    statuses: [],
    portal: new PortalManifest({ icon: null, color: null, category: null, config: [], pages: [], web: null }),
    ...changes,
  })

describe("manifestProblems", () => {
  it("accepts a valid manifest", () => {
    expect(manifestProblems(manifest())).toEqual([])
  })

  it("rejects other platform versions, reserved ids, and settings the Portal sets", () => {
    expect(manifestProblems(manifest({ platform: PLATFORM_MAJOR + 1 }))).toHaveLength(1)
    expect(manifestProblems(manifest({ id: "platform", access: "platform:view" }))).toHaveLength(1)
    expect(manifestProblems(manifest({ id: "portal", access: "portal:view" }))).toHaveLength(1)
    expect(
      manifestProblems(
        manifest({
          portal: new PortalManifest({
            icon: null,
            color: null,
            category: null,
            config: [
              { name: "MOSAIK_APP_KEY", label: null, description: "", kind: "text", required: true, secret: true },
            ],
            pages: [],
            web: null,
          }),
        }),
      ),
    ).toHaveLength(1)
  })

  it("rejects pages the shell could not list", () => {
    const withPages = (pages: PortalManifest["pages"]) =>
      manifestProblems(
        manifest({
          permissions: [
            new ManifestPermission({ key: "crm:view", description: "", dangerous: false, defaultRoles: [] }),
          ],
          portal: new PortalManifest({ icon: null, color: null, category: null, config: [], pages, web: null }),
        }),
      )
    expect(withPages([{ title: "Deals", path: "/deals", permission: "view" }])).toEqual([])
    expect(withPages([{ title: "Deals", path: "deals", permission: null }])).toHaveLength(1)
    expect(withPages([{ title: "Deals", path: "/deals", permission: "deals.edit" }])).toHaveLength(1)
  })
})
