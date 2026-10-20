import { describe, expect, it } from "@effect/vitest"
import { Setting, toSettingDeclaration } from "@mosaik/core"
import { DateTime } from "effect"
import { planChange, type StoredSetting, settingsView } from "./Settings"

const declarations = [
  toSettingDeclaration("refundLimit", Setting.number({ label: "Largest refund", min: 0, max: 1000, default: 500 })),
  toSettingDeclaration("exportsEnabled", Setting.boolean({ label: "Allow CSV exports", default: true })),
  toSettingDeclaration(
    "defaultRegion",
    Setting.choice({ label: "Default region", options: { emea: "EMEA", na: "North America" }, default: "emea" }),
  ),
]

const at = DateTime.makeUnsafe("2026-10-20T09:00:00Z")
const stored = (name: string, value: unknown): StoredSetting => ({
  name,
  value: value as never,
  changedBy: "Ada",
  changedAt: at,
})

describe("settingsView", () => {
  it("shows every declared setting: its default, or what was chosen and by whom", () => {
    const view = settingsView("sales", declarations, [stored("refundLimit", 250), stored("defaultRegion", "apac")])
    expect(view.settings.map((setting) => setting.declaration.name)).toEqual([
      "refundLimit",
      "exportsEnabled",
      "defaultRegion",
    ])
    const [limit, exports, region] = view.settings
    expect(limit).toMatchObject({ value: 250, changed: true, outdated: false, changedBy: "Ada" })
    expect(exports).toMatchObject({ value: true, changed: false, outdated: false, changedBy: null, changedAt: null })
    // Chosen when the app still had that option: the default applies, and the form says so.
    expect(region).toMatchObject({ value: "emea", changed: true, outdated: true })
  })
})

describe("planChange", () => {
  it("stores valid values and records what the app reads differently", () => {
    const plan = planChange(declarations, [stored("refundLimit", 250)], {
      values: { refundLimit: 300, exportsEnabled: false },
    })
    expect(plan).toEqual({
      _tag: "Valid",
      store: [
        { name: "refundLimit", value: 300 },
        { name: "exportsEnabled", value: false },
      ],
      reset: [],
      changes: [
        { name: "refundLimit", from: 250, to: 300 },
        { name: "exportsEnabled", from: true, to: false },
      ],
    })
  })

  it("refuses unknown settings and values that do not fit, with every problem", () => {
    expect(
      planChange(declarations, [], { values: { refundLimit: 5000, color: "red", defaultRegion: "apac" } }),
    ).toEqual({
      _tag: "Invalid",
      problems: [
        "Largest refund: At most 1000",
        "color: the app has no such setting",
        "Default region: One of: EMEA, North America",
      ],
    })
  })

  it("goes back to the default with null, and skips what would change nothing", () => {
    const plan = planChange(declarations, [stored("refundLimit", 250), stored("exportsEnabled", false)], {
      // Already 250; exports back to the default; the region has no value to remove.
      values: { refundLimit: 250, exportsEnabled: null, defaultRegion: null },
    })
    expect(plan).toEqual({
      _tag: "Valid",
      store: [],
      reset: ["exportsEnabled"],
      changes: [{ name: "exportsEnabled", from: false, to: true }],
    })
  })

  it("keeps a chosen value equal to the default, without counting it as a change", () => {
    // Stored, so it stays when a newer version of the app changes the default.
    expect(planChange(declarations, [], { values: { refundLimit: 500 } })).toEqual({
      _tag: "Valid",
      store: [{ name: "refundLimit", value: 500 }],
      reset: [],
      changes: [],
    })
  })
})
