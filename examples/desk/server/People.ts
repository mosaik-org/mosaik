import type { NotFound, Principal } from "@mosaik/sdk"
import { Context, Effect, Layer, Schema } from "effect"
import { SqlClient, SqlSchema } from "effect/sql"
import { Person } from "../api"
import { desk } from "../manifest"

/** Who the principal is, as a person the desk can name. Only someone signed in reaches the desk. */
export const personOf = (principal: Principal): Person => {
  const user = principal.user
  if (user === null) throw new Error("The desk's API needs someone signed in")
  return new Person({ id: user.id, name: user.name, email: user.email, image: user.image })
}

export const isAgent = (principal: Principal) => principal.can(desk.perm("requests.work"))

export interface PeopleStore {
  save(person: Person, agent: boolean): Effect.Effect<void>
  /** Someone's access changed: whether they can be given requests. */
  setAgent(id: string, agent: boolean): Effect.Effect<void>
  /** They are gone: nobody can give them anything, while what they said keeps their name. */
  markLeft(id: string): Effect.Effect<void>
  byIds(ids: ReadonlyArray<string>): Effect.Effect<ReadonlyMap<string, Person>>
  agents: Effect.Effect<ReadonlyArray<Person>>
  /** Whether someone can be given requests right now. */
  isAgent(id: string): Effect.Effect<boolean>
}

/** A person, or a stand-in when one is missing (a rule of data rather than something to fail over). */
export const nameless = (id: string) => new Person({ id, name: "Someone", email: "", image: null })

/**
 * The people the desk knows. Mosaik tells apps who is calling and when people change (events), not who
 * exists, so the desk keeps those it has met: everyone who opens it, and whoever Mosaik tells it about.
 */
export class People extends Context.Service<
  People,
  PeopleStore & {
    /** Remembers who is calling, once for as long as they and their access stay the same. */
    readonly remember: (principal: Principal) => Effect.Effect<Person>
  }
>()("@mosaik/desk/People") {}

export type NotFoundError = NotFound

/** `People` over a store: Postgres in production, in memory in tests. */
export const makePeople = (store: PeopleStore): Context.Service.Shape<typeof People> => {
  // What was last saved per person: asked on every request, and it rarely changes.
  const known = new Map<string, string>()
  return {
    ...store,
    // Told by events: whatever is known of them is stale.
    setAgent: (id, agent) =>
      Effect.andThen(
        Effect.sync(() => known.delete(id)),
        store.setAgent(id, agent),
      ),
    markLeft: (id) =>
      Effect.andThen(
        Effect.sync(() => known.delete(id)),
        store.markLeft(id),
      ),
    save: (person, agent) =>
      Effect.andThen(
        Effect.sync(() => known.delete(person.id)),
        store.save(person, agent),
      ),
    remember: (principal) =>
      Effect.gen(function* () {
        const person = personOf(principal)
        const agent = isAgent(principal)
        const fingerprint = JSON.stringify([person.name, person.email, person.image, agent])
        if (known.get(person.id) !== fingerprint) {
          yield* store.save(person, agent)
          known.set(person.id, fingerprint)
        }
        return person
      }),
  }
}

const PersonRow = Schema.Struct(Person.fields)

const PeopleStorePostgres = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient
  const columns = sql.literal("id, name, email, image")

  const store: PeopleStore = {
    save: (person, agent) =>
      sql`
        INSERT INTO people (id, name, email, image, is_agent)
        VALUES (${person.id}, ${person.name}, ${person.email}, ${person.image}, ${agent})
        ON CONFLICT (id) DO UPDATE
          SET name = excluded.name, email = excluded.email, image = excluded.image,
              is_agent = excluded.is_agent, left_at = NULL
      `.pipe(Effect.asVoid, Effect.orDie),

    setAgent: (id, agent) =>
      sql`UPDATE people SET is_agent = ${agent} WHERE id = ${id}`.pipe(Effect.asVoid, Effect.orDie),

    markLeft: (id) =>
      sql`UPDATE people SET is_agent = false, left_at = now() WHERE id = ${id}`.pipe(Effect.asVoid, Effect.orDie),

    byIds: (ids) =>
      ids.length === 0
        ? Effect.succeed(new Map())
        : SqlSchema.findAll({
            Request: Schema.Void,
            Result: PersonRow,
            execute: () => sql`SELECT ${columns} FROM people WHERE id IN ${sql.in(ids)}`,
          })().pipe(
            Effect.orDie,
            Effect.map((rows) => new Map(rows.map((row) => [row.id, new Person(row)]))),
          ),

    agents: SqlSchema.findAll({
      Request: Schema.Void,
      Result: PersonRow,
      execute: () => sql`SELECT ${columns} FROM people WHERE is_agent AND left_at IS NULL ORDER BY name`,
    })().pipe(
      Effect.orDie,
      Effect.map((rows) => rows.map((row) => new Person(row))),
    ),

    isAgent: (id) =>
      sql<{ isAgent: boolean }>`SELECT is_agent FROM people WHERE id = ${id} AND left_at IS NULL`.pipe(
        Effect.orDie,
        Effect.map(([row]) => row?.isAgent === true),
      ),
  }
  return store
})

export const PeoplePostgres = Layer.effect(People, Effect.map(PeopleStorePostgres, makePeople))
