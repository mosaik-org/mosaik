import { describe, expect, it } from "@effect/vitest"
import { defineApp, Setting } from "@mosaik/core"
import { Schema } from "effect"
import {
  AppManifest,
  type ConfigSetting,
  configFieldValue,
  configProblem,
  configText,
  PLATFORM_MAJOR,
  PLATFORM_VERSION,
  toAppManifest,
} from "./manifest"

const crm = defineApp({
  id: "crm",
  name: "CRM",
  access: "view",
  permissions: { view: { description: "View", defaultRoles: ["authenticated"] } },
  notifications: { "deal.won": { description: "A deal was won" } },
  database: true,
  settings: { dealLimit: Setting.number({ label: "Largest deal", min: 0, default: 1000 }) },
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
      storage: false,
      notifications: [expect.objectContaining({ key: "crm:deal.won", defaultChannels: ["inApp"] })],
    })
    expect(manifest.permissions.map((permission) => permission.key)).toEqual(["crm:view", "crm:access.manage"])
    expect(manifest.roles.map((role) => role.id)).toEqual(["crm:member", "crm:owner"])
    expect(manifest.settings).toEqual([
      {
        name: "dealLimit",
        kind: "number",
        label: "Largest deal",
        description: null,
        default: 1000,
        min: 0,
        max: null,
        integer: false,
        unit: null,
      },
    ])
    expect(manifest.portal).toMatchObject({
      icon: "users",
      category: null,
      config: [
        { name: "CRM_REGION", label: null, description: "Region", kind: "text", required: false, secret: false },
      ],
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

describe("config entries", () => {
  const entry = (kind: ConfigSetting["kind"]): ConfigSetting => ({
    name: "LIMIT",
    label: "Limit",
    description: "",
    kind,
    required: false,
    secret: false,
  })

  it("check the environment's text by kind, leaving empty to mean unset", () => {
    expect(configProblem(entry("number"), "25")).toBeUndefined()
    expect(configProblem(entry("number"), "lots")).toBe("Expected a number")
    expect(configProblem(entry("url"), "https://jira.example.com")).toBeUndefined()
    expect(configProblem(entry("url"), "jira.example.com")).toBe("An address starting with http:// or https://")
    expect(configProblem(entry("boolean"), "true")).toBeUndefined()
    expect(configProblem(entry("boolean"), "yes")).toBe("true or false")
    expect(configProblem(entry("number"), "")).toBeUndefined()
  })

  it("turn the text into the field's value and back", () => {
    expect(configFieldValue(entry("number"), "25")).toBe(25)
    expect(configFieldValue(entry("number"), "")).toBeNull()
    expect(configFieldValue(entry("boolean"), "true")).toBe(true)
    expect(configText(25)).toBe("25")
    expect(configText(false)).toBe("false")
    expect(configText(null)).toBe("")
  })
})
