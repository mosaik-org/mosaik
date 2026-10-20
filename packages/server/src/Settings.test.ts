import { describe, expect, it } from "@effect/vitest"
import { defineApp, Setting } from "@mosaik/core"
import { AppSettingsSnapshot } from "@mosaik/platform/contract"
import { PlatformClient } from "@mosaik/platform/server"
import { Effect, Fiber, Layer, Queue, Ref, Stream } from "effect"
import { Settings } from "./Settings"

const sales = defineApp({
  id: "sales",
  name: "Sales",
  access: "view",
  permissions: { view: { description: "View" } },
  settings: {
    refundLimit: Setting.number({ label: "Largest refund", min: 0, default: 500 }),
    exportsEnabled: Setting.boolean({ label: "Allow CSV exports", default: true }),
  },
})

/**
 * A platform that answers the first request at once and the following ones (which wait for a
 * change) with what the test sends, failing as many first requests as asked.
 */
const fakePlatform = (first: AppSettingsSnapshot, failures = 0) =>
  Effect.gen(function* () {
    const changes = yield* Queue.unbounded<AppSettingsSnapshot>()
    const calls = yield* Ref.make(0)
    const settings = ({ query }: { query: { after?: number } }) =>
      Effect.gen(function* () {
        const call = yield* Ref.getAndUpdate(calls, (n) => n + 1)
        if (call < failures) return yield* Effect.fail({ _tag: "Unavailable" as const })
        return query.after === undefined ? first : yield* Queue.take(changes)
      })
    const layer = Settings.layer.pipe(
      Layer.provide(Layer.succeed(PlatformClient, { app: { settings } } as unknown as PlatformClient["Service"])),
    )
    return { changes, layer }
  })

/** Reads until the value is the expected one: changes arrive in the background. */
const eventually = <A>(read: Effect.Effect<A>, expected: A) =>
  read.pipe(
    Effect.tap(() => Effect.sleep("5 millis")),
    Effect.repeat({ until: (value) => value === expected }),
    Effect.timeout("2 seconds"),
  )

describe("Settings", () => {
  it.live("reads the stored values, typed, and the defaults for the rest", () =>
    Effect.gen(function* () {
      const platform = yield* fakePlatform(new AppSettingsSnapshot({ version: 1, values: { refundLimit: 250 } }))
      yield* Effect.gen(function* () {
        const settings = yield* Settings.for(sales)
        const limit: number = yield* settings.get("refundLimit")
        expect(limit).toBe(250)
        expect(yield* settings.all).toEqual({ refundLimit: 250, exportsEnabled: true })
      }).pipe(Effect.provide(platform.layer))
    }),
  )

  it.live("follows changes while the app runs, and replaces values that no longer fit", () =>
    Effect.gen(function* () {
      const platform = yield* fakePlatform(new AppSettingsSnapshot({ version: 1, values: {} }))
      yield* Effect.gen(function* () {
        const settings = yield* Settings.for(sales)
        const seen = yield* settings.changes.pipe(Stream.take(3), Stream.runCollect, Effect.forkChild)
        yield* Effect.sleep("10 millis")

        yield* Queue.offer(platform.changes, new AppSettingsSnapshot({ version: 2, values: { refundLimit: 300 } }))
        yield* eventually(settings.get("refundLimit"), 300)
        // Stored when the limit allowed it; the manifest says at least 0 now.
        yield* Queue.offer(
          platform.changes,
          new AppSettingsSnapshot({ version: 3, values: { refundLimit: -1, exportsEnabled: false } }),
        )
        yield* eventually(settings.get("exportsEnabled"), false)
        expect(yield* settings.get("refundLimit")).toBe(500)

        expect([...(yield* Fiber.join(seen))]).toEqual([
          { refundLimit: 500, exportsEnabled: true },
          { refundLimit: 300, exportsEnabled: true },
          { refundLimit: 500, exportsEnabled: false },
        ])
      }).pipe(Effect.provide(platform.layer))
    }),
  )

  it.live("starts with the defaults while the platform cannot be reached, then catches up", () =>
    Effect.gen(function* () {
      const platform = yield* fakePlatform(new AppSettingsSnapshot({ version: 4, values: { refundLimit: 100 } }), 1)
      yield* Effect.gen(function* () {
        const settings = yield* Settings.for(sales)
        yield* eventually(settings.get("refundLimit"), 100)
      }).pipe(Effect.provide(platform.layer))
    }),
  )
})
