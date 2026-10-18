import { describe, expect, it } from "@effect/vitest"
import { DateTime, Effect } from "effect"
import { decodeEvents, latestAccessChanges } from "./EventRelay"

describe("latestAccessChanges", () => {
  it("keeps the last access change per user and every other event, in order", () => {
    const rows = [
      { id: 1, type: "user.created", userId: "a" },
      { id: 2, type: "user.access_changed", userId: "a" },
      { id: 3, type: "user.access_changed", userId: "b" },
      { id: 4, type: "user.access_changed", userId: "a" },
      { id: 5, type: "user.deleted", userId: "b" },
    ]
    expect(latestAccessChanges(rows).map((row) => row.id)).toEqual([1, 3, 4, 5])
  })
})

describe("decodeEvents", () => {
  it.effect("reads events in their JSON form, as built from the outbox", () =>
    Effect.gen(function* () {
      const [event] = yield* decodeEvents([
        {
          id: "49372cad-e59d-41a7-888c-b7bef2d6fabc",
          type: "user.created",
          occurredAt: "2026-10-16T21:04:50.418Z",
          data: { user: { id: "u1", email: "eve@mosaik.local", name: "Eve", image: null } },
        },
      ])
      expect(event?.type).toBe("user.created")
      expect(DateTime.formatIso(event?.occurredAt ?? DateTime.makeUnsafe(0))).toBe("2026-10-16T21:04:50.418Z")
    }),
  )
})
