import { describe, expect, it, layer } from "@effect/vitest"
import { AccessControl, CurrentPrincipal, defineApp, RequiredPermission, Setting } from "@mosaik/core"
import { StorageLimitReached } from "@mosaik/platform/contract"
import { Audiences, Audit, Events, Notify, Settings, Storage } from "@mosaik/server"
import { Effect, Ref, Schema } from "effect"
import { HttpApi, HttpApiBuilder, HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/http-api"
import { AppTest } from "./AppTest"
import { TestAudit, TestEvents, TestNotify, TestSettings, TestStorage } from "./platform"

const notes = defineApp({
  id: "notes",
  name: "Notes",
  access: "view",
  permissions: { view: { description: "Read notes" }, write: { description: "Write notes" } },
  notifications: { "note.written": { description: "A note was written" } },
  events: ["user.deleted"],
  settings: { maxLength: Setting.number({ label: "Longest note", min: 1, default: 100 }) },
  storage: true,
})

class NotesGroup extends HttpApiGroup.make("notes").add(
  HttpApiEndpoint.get("whoAmI", "/me", { success: Schema.String }),
  HttpApiEndpoint.post("write", "/notes/:name", {
    params: { name: Schema.String },
    payload: Schema.Struct({ text: Schema.String }),
    success: HttpApiSchema.NoContent,
    error: StorageLimitReached,
  }).annotate(RequiredPermission, notes.perm("write")),
) {}

class NotesApi extends HttpApi.make("notes").add(NotesGroup).prefix(notes.apiPrefix).middleware(AccessControl) {}

/** Users the app forgot, from `user.deleted`. */
const forgotten = Ref.makeUnsafe<ReadonlyArray<string>>([])

const Handlers = HttpApiBuilder.group(NotesApi, "notes", (handlers) =>
  Effect.gen(function* () {
    const audit = yield* Audit
    const notify = yield* Notify
    const storage = yield* Storage
    const settings = yield* Settings.for(notes)
    return handlers.handleAll({
      whoAmI: () => Effect.map(CurrentPrincipal, (principal) => principal.user?.name ?? "nobody"),
      write: ({ params, payload }) =>
        Effect.gen(function* () {
          const text = payload.text.slice(0, yield* settings.get("maxLength"))
          yield* storage.put(`notes/${params.name}.txt`, text, { contentType: "text/plain" })
          yield* audit.record({ action: "notes.write", target: params.name })
          yield* notify.send({
            type: notes.notification("note.written"),
            audience: Audiences.permission(notes.perm("view")),
            content: { title: `${params.name} was written` },
          })
        }).pipe(Effect.catchTag(["BadRequest", "StorageUnavailable", "NotifyError"], Effect.die)),
    })
  }),
)

const EventHandlers = Events.handlers(
  notes,
  Effect.succeed({ "user.deleted": ({ userId }) => Ref.update(forgotten, (all) => [...all, userId]) }),
)

const ada = AppTest.user({ id: "ada", name: "Ada", grants: [notes.perm("view"), notes.perm("write")] })
const reader = AppTest.user({ id: "grace", name: "Grace", grants: [notes.perm("view")] })

layer(AppTest.layer({ app: notes, api: NotesApi, handlers: Handlers, events: EventHandlers }))("AppTest", (it) => {
  describe("access control", () => {
    it.effect("signs people in with the grants the test gives them", () =>
      Effect.gen(function* () {
        const api = yield* AppTest.client(NotesApi)
        expect(yield* api.as(ada, (client) => client.notes.whoAmI())).toBe("Ada")
      }),
    )

    it.effect("checks permissions as in production", () =>
      Effect.gen(function* () {
        const api = yield* AppTest.client(NotesApi)
        const write = (client: Parameters<Parameters<typeof api.as>[1]>[0]) =>
          client.notes.write({ params: { name: "a" }, payload: { text: "hi" } })
        expect((yield* Effect.flip(api.as(reader, write)))._tag).toBe("Forbidden")
        expect((yield* Effect.flip(api.as(AppTest.visitor, (client) => client.notes.whoAmI())))._tag).toBe(
          "Unauthorized",
        )
      }),
    )
  })

  it.effect("records what the app did, and gives it the settings a test sets", () =>
    Effect.gen(function* () {
      const api = yield* AppTest.client(NotesApi)
      yield* (yield* TestSettings.for(notes)).set("maxLength", 5)
      yield* api.as(ada, (client) =>
        client.notes.write({ params: { name: "groceries" }, payload: { text: "milk, eggs" } }),
      )

      const file = (yield* (yield* TestStorage).files).get("notes/groceries.txt")
      expect(new TextDecoder().decode(file?.bytes)).toBe("milk,")
      expect(file?.object.contentType).toBe("text/plain")
      expect(yield* (yield* TestAudit).entries).toContainEqual(
        expect.objectContaining({
          action: "notes.write",
          target: "groceries",
          actor: expect.objectContaining({ name: "Ada" }),
        }),
      )
      expect((yield* (yield* TestNotify).sent).map((sent) => sent.content.title)).toContain("groceries was written")
    }),
  )

  it.effect("runs out of room at the limit a test sets", () =>
    Effect.gen(function* () {
      const api = yield* AppTest.client(NotesApi)
      // The tests of one layer share the app, as requests share a running one: start from the defaults.
      yield* (yield* TestSettings).reset
      yield* (yield* TestStorage).setLimit(30)
      const error = yield* Effect.flip(
        api.as(ada, (client) => client.notes.write({ params: { name: "long" }, payload: { text: "x".repeat(60) } })),
      )
      expect(error._tag).toBe("StorageLimitReached")
      yield* (yield* TestStorage).setLimit(null)
    }),
  )

  it.effect("delivers platform events to the app's handlers", () =>
    Effect.gen(function* () {
      yield* (yield* TestEvents).deliver("user.deleted", { userId: "ada" })
      expect(yield* Ref.get(forgotten)).toEqual(["ada"])
    }),
  )
})

describe("AppTest.user", () => {
  it("is someone with an id, a name and an e-mail", () => {
    expect(AppTest.user({ grants: ["notes:view"] })).toEqual({
      user: { id: "test-user", name: "Test User", email: "test-user@example.com" },
      grants: ["notes:view"],
    })
  })
})
