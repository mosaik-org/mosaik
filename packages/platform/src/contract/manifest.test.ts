import { describe, expect, it } from "@effect/vitest"
import { defineApp } from "@mosaik/core"
import { Schema } from "effect"
import { AppManifest, PLATFORM_MAJOR, PLATFORM_VERSION, toAppManifest } from "./manifest"

const crm = defineApp({
  id: "crm",
  name: "CRM",
  access: "view",
  permissions: { view: { description: "View", defaultRoles: ["authenticated"] } },
  notifications: { "deal.won": { description: "A deal was won" } },
  database: true,
  portal: { icon: "users", config: { CRM_REGION: { description: "Region", required: false } } },
})

describe("toAppManifest", () => {
  it("serializes the manifest as static JSON", () => {
    const manifest = toAppManifest(crm)
    expect(manifest).toMatchObject({
      id: "crm",
      version: PLATFORM_VERSION,
      platform: PLATFORM_MAJOR,
      access: "crm:view",
      database: true,
      notifications: [expect.objectContaining({ key: "crm:deal.won", defaultChannels: ["inApp"] })],
    })
    expect(manifest.permissions.map((permission) => permission.key)).toEqual(["crm:view", "crm:access.manage"])
    expect(manifest.roles.map((role) => role.id)).toEqual(["crm:member", "crm:owner"])
    expect(manifest.portal).toMatchObject({
      icon: "users",
      category: null,
      config: [{ name: "CRM_REGION", description: "Region", required: false, secret: false }],
      web: null,
    })
    const json = JSON.parse(JSON.stringify(Schema.encodeSync(AppManifest)(manifest)))
    expect(Schema.decodeUnknownSync(AppManifest)(json)).toEqual(manifest)
  })

  it("uses the app's own version when it has one", () => {
    const { roles: _, ...spec } = crm
    expect(toAppManifest(defineApp({ ...spec, version: "2.3.0", notifications: {} })).version).toBe("2.3.0")
  })
})
