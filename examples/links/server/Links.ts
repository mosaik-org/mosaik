import { Context, DateTime, Effect, Layer, Option, Schema } from "effect"
import { SqlClient, SqlSchema } from "effect/sql"
import { Link, Person } from "../api"

const LinkRow = Schema.Struct({
  id: Schema.Int,
  title: Schema.String,
  url: Schema.String,
  addedById: Schema.String,
  addedByName: Schema.String,
  addedAt: Schema.DateTimeUtcFromDate,
})

const toLink = (row: typeof LinkRow.Type) =>
  new Link({
    id: row.id,
    title: row.title,
    url: row.url,
    addedBy: new Person({ id: row.addedById, name: row.addedByName }),
    addedAt: row.addedAt,
  })

/** The links, in the app's own database. */
export class Links extends Context.Service<
  Links,
  {
    readonly list: Effect.Effect<ReadonlyArray<Link>>
    add(link: { readonly title: string; readonly url: string }, by: Person): Effect.Effect<Link>
    get(id: number): Effect.Effect<Option.Option<Link>>
    remove(id: number): Effect.Effect<void>
  }
>()("@mosaik/links/Links") {
  static readonly layer = Layer.effect(
    Links,
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient
      const columns = sql.literal("id, title, url, added_by_id, added_by_name, added_at")

      const all = SqlSchema.findAll({
        Request: Schema.Void,
        Result: LinkRow,
        execute: () => sql`SELECT ${columns} FROM links ORDER BY added_at DESC, id DESC`,
      })
      const insert = SqlSchema.findOne({
        Request: Schema.Struct({
          title: Schema.String,
          url: Schema.String,
          addedById: Schema.String,
          addedByName: Schema.String,
        }),
        Result: LinkRow,
        execute: (row) => sql`INSERT INTO links ${sql.insert(row)} RETURNING ${columns}`,
      })
      const byId = SqlSchema.findOneOption({
        Request: Schema.Int,
        Result: LinkRow,
        execute: (id) => sql`SELECT ${columns} FROM links WHERE id = ${id}`,
      })

      return Links.of({
        // A failing database is not something a caller can answer: the API reports it as a server error.
        list: all(undefined).pipe(
          Effect.map((rows) => rows.map(toLink)),
          Effect.orDie,
        ),
        add: (link, by) =>
          insert({ ...link, addedById: by.id, addedByName: by.name }).pipe(Effect.map(toLink), Effect.orDie),
        get: (id) => byId(id).pipe(Effect.map(Option.map(toLink)), Effect.orDie),
        remove: (id) => sql`DELETE FROM links WHERE id = ${id}`.pipe(Effect.asVoid, Effect.orDie),
      })
    }),
  )
}

/** `Links` kept in memory, for the API's tests: the same service, so they run anywhere and at once. */
export const InMemoryLinks = Layer.sync(Links, () => {
  const rows = new Map<number, Link>()
  let next = 1
  return Links.of({
    list: Effect.sync(() => [...rows.values()].reverse()),
    add: (link, by) =>
      Effect.map(DateTime.now, (addedAt) => {
        const added = new Link({ ...link, id: next++, addedBy: by, addedAt })
        rows.set(added.id, added)
        return added
      }),
    get: (id) => Effect.sync(() => Option.fromUndefinedOr(rows.get(id))),
    remove: (id) => Effect.sync(() => void rows.delete(id)),
  })
})
