import type { PrincipalUser } from "@mosaik/sdk"
import { Context, DateTime, Effect, Layer, Option, Ref } from "effect"
import { Note } from "../api"

/** The notes, in memory: the example is about Core, not storage (they are gone on restart). */
export class Notes extends Context.Service<
  Notes,
  {
    readonly list: Effect.Effect<ReadonlyArray<Note>>
    create(text: string, author: PrincipalUser): Effect.Effect<Note>
    get(id: string): Effect.Effect<Option.Option<Note>>
    delete(id: string): Effect.Effect<void>
  }
>()("@mosaik/example-notes/Notes") {
  static readonly layer = Layer.effect(
    Notes,
    Effect.gen(function* () {
      const notes = yield* Ref.make<ReadonlyArray<Note>>([])
      return Notes.of({
        list: Ref.get(notes),
        create: Effect.fn(function* (text: string, author: PrincipalUser) {
          const note = new Note({ id: crypto.randomUUID(), text, author, createdAt: yield* DateTime.now })
          yield* Ref.update(notes, (all) => [note, ...all])
          return note
        }),
        get: (id) => Effect.map(Ref.get(notes), (all) => Option.fromUndefinedOr(all.find((note) => note.id === id))),
        delete: (id) => Ref.update(notes, (all) => all.filter((note) => note.id !== id)),
      })
    }),
  )
}
