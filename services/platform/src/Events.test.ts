import { describe, expect, it } from "@effect/vitest"
import { AppManifest, PLATFORM_MAJOR, PortalManifest } from "@mosaik/platform/contract"
import { DateTime } from "effect"
import { forApp } from "./Events"

const manifest = new AppManifest({
  id: "crm",
  name: "CRM",
  description: null,
  version: "1.0.0",
  platform: PLATFORM_MAJOR,
  access: "crm:view",
  permissions: [],
  roles: [],
  notifications: [],
  events: ["user.access_changed", "user.deleted"],
  database: false,
  settings: [],
  portal: new PortalManifest({ icon: null, category: null, config: [], web: null }),
})

const row = (type: "user.access_changed" | "user.deleted", data: unknown) => ({
  seq: 7,
  id: "0b0f4a52-6c43-4a43-9d5c-6f1f6f0a9b10",
  type,
  occurredAt: DateTime.makeUnsafe("2026-10-16T10:00:00Z"),
  data: data as never,
})

describe("forApp", () => {
  it("narrows access changes to the app's own grants, like its tokens", () => {
    const event = forApp(
      row("user.access_changed", { userId: "u1", grants: ["crm:view", "crm:deals.*", "sales:view"] }),
      manifest,
    )
    expect(event.position).toBe(7)
    expect(event.data).toEqual({ userId: "u1", hasAccess: true, grants: ["crm:view", "crm:deals.*"] })
  })

  it("tells the app when the user lost access", () => {
    const event = forApp(row("user.access_changed", { userId: "u1", grants: ["sales:*"] }), manifest)
    expect(event.data).toEqual({ userId: "u1", hasAccess: false, grants: [] })
  })

  it("keeps the superadmin wildcard", () => {
    const event = forApp(row("user.access_changed", { userId: "u1", grants: ["*"] }), manifest)
    expect(event.data).toEqual({ userId: "u1", hasAccess: true, grants: ["*"] })
  })

  it("passes other events through", () => {
    expect(forApp(row("user.deleted", { userId: "u1" }), manifest).data).toEqual({ userId: "u1" })
  })
})
