import { describe, expect, it } from "@effect/vitest"
import { defineApp } from "@mosaik/core"
import { AppEvent } from "@mosaik/platform/contract"
import { DateTime, Effect, Exit, Ref } from "effect"
import { EventHandlers, Events } from "./Events"

const crm = defineApp({
  id: "crm",
  name: "CRM",
  access: "view",
  permissions: { view: { description: "View" } },
  events: ["user.deleted", "user.access_changed"],
})

const event = (type: AppEvent["type"], data: unknown) =>
  new AppEvent({
    id: "0b0f4a52-6c43-4a43-9d5c-6f1f6f0a9b10",
    position: 1,
    type,
    occurredAt: DateTime.makeUnsafe("2026-10-16T10:00:00Z"),
    data: data as never,
  })

describe("Events.handlers", () => {
  it.effect("decodes each event's data for its handler", () =>
    Effect.gen(function* () {
      const seen = yield* Ref.make<ReadonlyArray<string>>([])
      const handlers = yield* EventHandlers.pipe(
        Effect.provide(
          Events.handlers(
            crm,
            Effect.succeed({
              "user.deleted": ({ userId }) => Ref.update(seen, (all) => [...all, `deleted ${userId}`]),
              "user.access_changed": ({ userId, hasAccess }) =>
                Ref.update(seen, (all) => [...all, `${userId} ${hasAccess ? "can" : "cannot"}`]),
            }),
          ),
        ),
      )
      yield* handlers.handle(event("user.deleted", { userId: "u1" }))
      yield* handlers.handle(event("user.access_changed", { userId: "u2", hasAccess: false, grants: [] }))
      expect(yield* Ref.get(seen)).toEqual(["deleted u1", "u2 cannot"])
    }),
  )

  it.effect("fails an event whose data does not match its type", () =>
    Effect.gen(function* () {
      const handlers = yield* EventHandlers.pipe(
        Effect.provide(
          Events.handlers(
            crm,
            Effect.succeed({ "user.deleted": () => Effect.void, "user.access_changed": () => Effect.void }),
          ),
        ),
      )
      const exit = yield* Effect.exit(handlers.handle(event("user.deleted", { nope: true })))
      expect(Exit.isFailure(exit)).toBe(true)
    }),
  )

  it.effect("refuses to start without a handler for every subscribed event", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(
        EventHandlers.pipe(
          Effect.provide(Events.handlers(crm, Effect.succeed({ "user.deleted": () => Effect.void } as never))),
        ),
      )
      expect(Exit.isFailure(exit)).toBe(true)
    }),
  )
})
