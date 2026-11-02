import { randomUUID } from "node:crypto"
import { PgClient } from "@effect/sql-pg"
import { ConversationSummary, Message, MessagePart, PageContext } from "@mosaik/assistant/contract"
import { Context, Effect, Layer, Option, Schema } from "effect"
import { SqlSchema } from "effect/sql"

const SummaryRow = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  createdAt: Schema.DateTimeUtcFromDate,
  updatedAt: Schema.DateTimeUtcFromDate,
})

const MessageRow = Schema.Struct({
  id: Schema.Number,
  role: Message.fields.role,
  parts: Schema.Array(MessagePart),
  context: Schema.NullOr(PageContext),
  createdAt: Schema.DateTimeUtcFromDate,
})

/** A title from the person's first message: its first line, shortened. */
export const titleOf = (text: string): string => {
  const line = text.split("\n")[0]?.trim() ?? ""
  return line.length > 60 ? `${line.slice(0, 57).trimEnd()}…` : line
}

/** What a stored message needs; its id and time are the database's. */
export interface NewMessage {
  readonly role: Message["role"]
  readonly parts: ReadonlyArray<MessagePart>
  readonly context?: PageContext | null
}

/**
 * Each person's conversations with the assistant, kept until deleted: only their own are ever
 * read (every query names the user).
 */
export class Conversations extends Context.Service<
  Conversations,
  {
    readonly list: (userId: string) => Effect.Effect<ReadonlyArray<ConversationSummary>>
    readonly start: (userId: string) => Effect.Effect<ConversationSummary>
    /** The conversation with its messages, oldest first, if it is the user's. */
    readonly find: (
      userId: string,
      id: string,
    ) => Effect.Effect<
      Option.Option<{ readonly summary: ConversationSummary; readonly messages: ReadonlyArray<Message> }>
    >
    /** Stores a message; the person's first one also names the conversation. */
    readonly append: (id: string, message: NewMessage) => Effect.Effect<Message>
  }
>()("@mosaik/assistant-service/Conversations") {
  static readonly layer = Layer.effect(
    Conversations,
    Effect.gen(function* () {
      const sql = yield* PgClient.PgClient

      const findSummaries = SqlSchema.findAll({
        Request: Schema.Struct({ userId: Schema.String, id: Schema.optional(Schema.String) }),
        Result: SummaryRow,
        execute: ({ userId, id }) => sql`
          SELECT id, title, created_at, updated_at FROM conversations
          WHERE ${sql.and([sql`user_id = ${userId}`, id === undefined ? sql.literal("true") : sql`id = ${id}`])}
          ORDER BY updated_at DESC
        `,
      })
      const findMessages = SqlSchema.findAll({
        Request: Schema.String,
        Result: MessageRow,
        execute: (id) => sql`
          SELECT id::float8 AS id, role, parts, context, created_at FROM messages
          WHERE conversation_id = ${id} ORDER BY id
        `,
      })
      const insertMessage = SqlSchema.findOne({
        Request: Schema.Struct({
          id: Schema.String,
          role: Message.fields.role,
          parts: Schema.Array(MessagePart),
          context: Schema.NullOr(PageContext),
        }),
        Result: MessageRow,
        execute: ({ id, role, parts, context }) => sql`
          INSERT INTO messages (conversation_id, role, parts, context)
          VALUES (${id}, ${role}, ${sql.json(parts)}, ${context === null ? null : sql.json(context)})
          RETURNING id::float8 AS id, role, parts, context, created_at
        `,
      })

      return Conversations.of({
        list: (userId) =>
          findSummaries({ userId }).pipe(
            Effect.map((rows) => rows.map((row) => new ConversationSummary(row))),
            Effect.orDie,
          ),

        start: Effect.fn("Conversations.start")(function* (userId) {
          const [row] = yield* sql<typeof SummaryRow.Encoded>`
            INSERT INTO conversations ${sql.insert({ id: randomUUID(), userId, title: "" })}
            RETURNING id, title, created_at, updated_at
          `.pipe(Effect.orDie)
          return new ConversationSummary(yield* Schema.decodeUnknownEffect(SummaryRow)(row).pipe(Effect.orDie))
        }),

        find: Effect.fn("Conversations.find")(function* (userId, id) {
          const [summary] = yield* findSummaries({ userId, id }).pipe(Effect.orDie)
          if (summary === undefined) return Option.none()
          const messages = yield* findMessages(id).pipe(Effect.orDie)
          return Option.some({
            summary: new ConversationSummary(summary),
            messages: messages.map((row) => new Message(row)),
          })
        }),

        append: Effect.fn("Conversations.append")(function* (id, message) {
          const row = yield* insertMessage({
            id,
            role: message.role,
            parts: message.parts,
            context: message.context ?? null,
          }).pipe(Effect.orDie)
          const first = message.role === "user" ? message.parts.find((part) => part.type === "text") : undefined
          yield* sql`
            UPDATE conversations
            SET updated_at = now(), title = CASE WHEN title = '' THEN ${first === undefined ? "" : titleOf(first.text)} ELSE title END
            WHERE id = ${id}
          `.pipe(Effect.orDie)
          return new Message(row)
        }),
      })
    }),
  )
}
