import { describe, expect, it } from "@effect/vitest"
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
    portal: new PortalManifest({ icon: null, category: null, config: [], web: null }),
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
            category: null,
            config: [
              { name: "MOSAIK_APP_KEY", label: null, description: "", kind: "text", required: true, secret: true },
            ],
            web: null,
          }),
        }),
      ),
    ).toHaveLength(1)
  })
})
