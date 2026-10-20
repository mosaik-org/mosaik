import { describe, expect, expectTypeOf, it } from "@effect/vitest"
import { Schema } from "effect"
import { defineApp } from "./manifest"
import {
  fromSettingDeclaration,
  Setting,
  SettingDeclaration,
  type SettingValues,
  settingProblem,
  settingValue,
  toSettingDeclaration,
} from "./settings"

const settings = {
  refundLimit: Setting.number({ label: "Largest refund", unit: "EUR", min: 0, max: 10_000, default: 500 }),
  banner: Setting.text({ label: "Notice", multiline: true, maxLength: 10, default: "" }),
  docs: Setting.text({ label: "Docs", format: "url", default: "" }),
  exportsEnabled: Setting.boolean({ label: "Allow CSV exports", default: true }),
  defaultRegion: Setting.choice({
    label: "Default region",
    options: { emea: "EMEA", na: "North America" },
    default: "emea",
  }),
}

describe("settingProblem", () => {
  it("accepts what fits, says why not otherwise", () => {
    expect(settingProblem(settings.refundLimit, 250)).toBeUndefined()
    expect(settingProblem(settings.refundLimit, -1)).toBe("At least 0")
    expect(settingProblem(settings.refundLimit, 20_000)).toBe("At most 10000")
    expect(settingProblem(settings.refundLimit, "250")).toBe("Expected a number")
    expect(settingProblem(Setting.number({ label: "Days", integer: true, default: 1 }), 1.5)).toBe("A whole number")

    expect(settingProblem(settings.banner, "short")).toBeUndefined()
    expect(settingProblem(settings.banner, "far too long")).toBe("At most 10 characters")
    expect(settingProblem(settings.docs, "https://docs.example.com/sales")).toBeUndefined()
    expect(settingProblem(settings.docs, "")).toBeUndefined()
    expect(settingProblem(settings.docs, "docs.example.com")).toBe("An address starting with http:// or https://")

    expect(settingProblem(settings.exportsEnabled, false)).toBeUndefined()
    expect(settingProblem(settings.exportsEnabled, "false")).toBe("Expected yes or no")

    expect(settingProblem(settings.defaultRegion, "na")).toBeUndefined()
    expect(settingProblem(settings.defaultRegion, "apac")).toBe("One of: EMEA, North America")
    // Not an option, though every object has it.
    expect(settingProblem(settings.defaultRegion, "toString")).toBe("One of: EMEA, North America")
  })
})

describe("settingValue", () => {
  it("uses the stored value when it fits, else the default", () => {
    expect(settingValue(settings.refundLimit, 250)).toBe(250)
    expect(settingValue(settings.refundLimit, undefined)).toBe(500)
    // Stored before the declaration changed (a tighter limit, a removed option).
    expect(settingValue(settings.refundLimit, 20_000)).toBe(500)
    expect(settingValue(settings.defaultRegion, "apac")).toBe("emea")
  })
})

describe("the manifest's form", () => {
  it("round-trips every kind through JSON", () => {
    for (const [name, setting] of Object.entries(settings)) {
      const json = JSON.parse(
        JSON.stringify(Schema.encodeSync(SettingDeclaration)(toSettingDeclaration(name, setting))),
      )
      const declared = Schema.decodeUnknownSync(SettingDeclaration)(json)
      expect(declared.name).toBe(name)
      expect(fromSettingDeclaration(declared)).toEqual(setting)
    }
  })
})

describe("defineApp", () => {
  const app = (extra: object) =>
    defineApp({ id: "crm", name: "CRM", access: "view", permissions: { view: { description: "View" } }, ...extra })

  it("keeps the settings, typed", () => {
    const crm = defineApp({
      id: "crm",
      name: "CRM",
      access: "view",
      permissions: { view: { description: "View" } },
      settings,
    })
    expect(crm.settings.refundLimit.default).toBe(500)
    expectTypeOf<SettingValues<typeof crm.settings>>().toEqualTypeOf<{
      readonly refundLimit: number
      readonly banner: string
      readonly docs: string
      readonly exportsEnabled: boolean
      readonly defaultRegion: "emea" | "na"
    }>()
    expect(app({}).settings).toEqual({})
  })

  it("refuses a setting it could not serve", () => {
    expect(() => app({ settings: { "refund-limit": settings.refundLimit } })).toThrow(/Invalid setting name/)
    expect(() => app({ settings: { limit: Setting.number({ label: "Limit", min: 0, default: -5 }) } })).toThrow(
      'Default of setting "limit" in app "crm": At least 0',
    )
  })
})
