import { CurrentPrincipal, NotFound } from "@mosaik/sdk"
import { Audiences, Audit, Notify, runApp } from "@mosaik/sdk/server"
import { Effect, Layer, Option } from "effect"
import { HttpApiBuilder } from "effect/http-api"
import { NotesApi } from "../api"
import { notes } from "../manifest"
import { Notes } from "./Notes"

/** The signed-in user: every endpoint needs a permission, so there always is one. */
const author = Effect.flatMap(CurrentPrincipal, (principal) =>
  principal.user === null
    ? Effect.die("AccessControl lets only signed-in users write")
    : Effect.succeed(principal.user),
)

const NotesHandlers = HttpApiBuilder.group(
  NotesApi,
  "notes",
  Effect.fn(function* (handlers) {
    const store = yield* Notes
    const audit = yield* Audit
    const notify = yield* Notify

    return handlers.handleAll({
      list: () => store.list,

      create: Effect.fn(function* ({ payload }) {
        const user = yield* author
        const note = yield* store.create(payload.text, user)
        yield* audit.record({ action: "notes.create", target: note.id, details: { length: note.text.length } })
        // Everyone else who reads notes; a failed notification never fails the note.
        yield* notify
          .send({
            type: notes.notification("note.posted"),
            audience: Audiences.permission(notes.perm("view")),
            exclude: [user.id],
            content: { title: `${user.name} posted a note`, body: note.text },
          })
          .pipe(Effect.ignore)
        return note
      }),

      delete: Effect.fn(function* ({ params }) {
        const principal = yield* CurrentPrincipal
        const note = yield* store.get(params.id)
        const mine = Option.exists(note, (note) => note.author.id === principal.user?.id)
        if (Option.isNone(note) || (!mine && !principal.can(notes.perm("notes.delete")))) {
          return yield* new NotFound({ resource: "note", id: params.id })
        }
        yield* store.delete(params.id)
        yield* audit.record({ action: "notes.delete", target: params.id, details: { own: mine } })
      }),
    })
  }),
)

runApp({ app: notes, api: NotesApi, handlers: NotesHandlers.pipe(Layer.provide(Notes.layer)) })
