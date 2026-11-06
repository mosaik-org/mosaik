import { Conflict, NotFound } from "@mosaik/sdk"
import { Context, Effect, Layer, Schema } from "effect"
import { SqlClient, SqlSchema } from "effect/sql"
import {
  DeadlineRule,
  PRIORITIES,
  type Priority,
  Queue,
  type QueueId,
  type QueueInput,
  SavedReply,
  type SavedReplyId,
  type SavedReplyInput,
} from "../api"

/** How the desk is set up: its queues, how fast each priority is due, and its saved replies. */
export class Setup extends Context.Service<
  Setup,
  {
    queues: Effect.Effect<ReadonlyArray<Queue>>
    createQueue(input: QueueInput): Effect.Effect<Queue, Conflict>
    updateQueue(id: QueueId, input: QueueInput): Effect.Effect<Queue, NotFound | Conflict>
    removeQueue(id: QueueId): Effect.Effect<void, NotFound>

    deadlines: Effect.Effect<ReadonlyArray<DeadlineRule>>
    deadline(priority: Priority): Effect.Effect<DeadlineRule>
    setDeadline(rule: DeadlineRule): Effect.Effect<DeadlineRule>

    savedReplies: Effect.Effect<ReadonlyArray<SavedReply>>
    createSavedReply(input: SavedReplyInput): Effect.Effect<SavedReply>
    updateSavedReply(id: SavedReplyId, input: SavedReplyInput): Effect.Effect<SavedReply, NotFound>
    removeSavedReply(id: SavedReplyId): Effect.Effect<void, NotFound>
  }
>()("@mosaik/desk/Setup") {
  static readonly layer = Layer.effect(
    Setup,
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient

      const allQueues = SqlSchema.findAll({
        Request: Schema.Void,
        Result: Schema.Struct(Queue.fields),
        execute: () => sql`SELECT id, name, description FROM queues ORDER BY name`,
      })().pipe(
        Effect.orDie,
        Effect.map((rows) => rows.map((row) => new Queue(row))),
      )

      /** Queues are told apart by name, so two of the same name would be a trap. */
      const nameFree = Effect.fn("Setup.nameFree")(function* (name: string, self?: QueueId) {
        const same = yield* sql<{ id: number }>`SELECT id FROM queues WHERE name = ${name}`.pipe(Effect.orDie)
        if (same.some((row) => row.id !== self)) {
          return yield* new Conflict({ message: `There is a queue called ${name} already` })
        }
      })

      const allDeadlines = SqlSchema.findAll({
        Request: Schema.Void,
        Result: Schema.Struct(DeadlineRule.fields),
        execute: () => sql`SELECT priority, respond_minutes, resolve_minutes FROM deadline_rules`,
      })().pipe(
        Effect.orDie,
        Effect.map((rows) => {
          const byPriority = new Map(rows.map((row) => [row.priority, new DeadlineRule(row)]))
          return PRIORITIES.flatMap((priority) => byPriority.get(priority) ?? [])
        }),
      )

      const allSavedReplies = SqlSchema.findAll({
        Request: Schema.Void,
        Result: Schema.Struct(SavedReply.fields),
        execute: () => sql`SELECT id, title, body FROM saved_replies ORDER BY title`,
      })().pipe(
        Effect.orDie,
        Effect.map((rows) => rows.map((row) => new SavedReply(row))),
      )

      const queueRow = (rows: ReadonlyArray<typeof Queue.Encoded>, id: string) => {
        const [row] = rows
        return row === undefined
          ? Effect.fail(new NotFound({ resource: "queue", id }))
          : Effect.succeed(new Queue(row as ConstructorParameters<typeof Queue>[0]))
      }

      const savedReplyRow = (rows: ReadonlyArray<typeof SavedReply.Encoded>, id: string) => {
        const [row] = rows
        return row === undefined
          ? Effect.fail(new NotFound({ resource: "saved reply", id }))
          : Effect.succeed(new SavedReply(row as ConstructorParameters<typeof SavedReply>[0]))
      }

      return Setup.of({
        queues: allQueues,

        createQueue: Effect.fn("Setup.createQueue")(function* (input: QueueInput) {
          yield* nameFree(input.name)
          const rows = yield* sql<typeof Queue.Encoded>`
            INSERT INTO queues (name, description) VALUES (${input.name}, ${input.description})
            RETURNING id, name, description
          `.pipe(Effect.orDie)
          return yield* queueRow(rows, input.name).pipe(Effect.orDie)
        }),

        updateQueue: Effect.fn("Setup.updateQueue")(function* (id: QueueId, input: QueueInput) {
          yield* nameFree(input.name, id)
          const rows = yield* sql<typeof Queue.Encoded>`
            UPDATE queues SET name = ${input.name}, description = ${input.description} WHERE id = ${id}
            RETURNING id, name, description
          `.pipe(Effect.orDie)
          return yield* queueRow(rows, String(id))
        }),

        removeQueue: Effect.fn("Setup.removeQueue")(function* (id: QueueId) {
          const deleted = yield* sql<{ id: number }>`DELETE FROM queues WHERE id = ${id} RETURNING id`.pipe(
            Effect.orDie,
          )
          if (deleted.length === 0) return yield* new NotFound({ resource: "queue", id: String(id) })
        }),

        deadlines: allDeadlines,

        deadline: (priority) =>
          allDeadlines.pipe(
            Effect.flatMap((rules) => {
              const rule = rules.find((candidate) => candidate.priority === priority)
              return rule === undefined ? Effect.die(`No deadline rule for ${priority}`) : Effect.succeed(rule)
            }),
          ),

        setDeadline: (rule) =>
          sql`
            INSERT INTO deadline_rules (priority, respond_minutes, resolve_minutes)
            VALUES (${rule.priority}, ${rule.respondMinutes}, ${rule.resolveMinutes})
            ON CONFLICT (priority) DO UPDATE
              SET respond_minutes = excluded.respond_minutes, resolve_minutes = excluded.resolve_minutes
          `.pipe(Effect.orDie, Effect.as(rule)),

        savedReplies: allSavedReplies,

        createSavedReply: (input) =>
          sql<typeof SavedReply.Encoded>`
            INSERT INTO saved_replies (title, body) VALUES (${input.title}, ${input.body})
            RETURNING id, title, body
          `.pipe(
            Effect.orDie,
            Effect.flatMap((rows) => savedReplyRow(rows, input.title).pipe(Effect.orDie)),
          ),

        updateSavedReply: (id, input) =>
          sql<typeof SavedReply.Encoded>`
            UPDATE saved_replies SET title = ${input.title}, body = ${input.body} WHERE id = ${id}
            RETURNING id, title, body
          `.pipe(
            Effect.orDie,
            Effect.flatMap((rows) => savedReplyRow(rows, String(id))),
          ),

        removeSavedReply: Effect.fn("Setup.removeSavedReply")(function* (id: SavedReplyId) {
          const deleted = yield* sql<{ id: number }>`DELETE FROM saved_replies WHERE id = ${id} RETURNING id`.pipe(
            Effect.orDie,
          )
          if (deleted.length === 0) return yield* new NotFound({ resource: "saved reply", id: String(id) })
        }),
      })
    }),
  )
}
