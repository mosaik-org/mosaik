import { PgClient } from "@effect/sql-pg"
import { Content, InboxItem, InboxPage } from "@mosaik/notifications/contract"
import { Context, Effect, Layer, Schema } from "effect"
import { SqlSchema } from "effect/sql"

const ItemRow = Schema.Struct({
  id: Schema.Number,
  type: Schema.String,
  source: Schema.String,
  content: Content,
  createdAt: Schema.DateTimeUtcFromDate,
  readAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
})

export interface InboxQuery {
  readonly before?: number | undefined
  readonly limit?: number | undefined
  readonly unreadOnly?: boolean | undefined
}

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

/** Users' in-app notifications. */
export class Inbox extends Context.Service<
  Inbox,
  {
    list(userId: string, query: InboxQuery): Effect.Effect<InboxPage>
    unread(userId: string): Effect.Effect<number>
    markRead(userId: string, ids: ReadonlyArray<number>): Effect.Effect<void>
    markAllRead(userId: string): Effect.Effect<void>
    /** The inbox items one message created, by user (for live updates). */
    itemsForMessage(
      messageId: number,
    ): Effect.Effect<ReadonlyArray<{ readonly userId: string; readonly item: InboxItem }>>
  }
>()("@mosaik/notifications-service/Inbox") {
  static readonly layer = Layer.effect(
    Inbox,
    Effect.gen(function* () {
      const sql = yield* PgClient.PgClient
      const columns = sql.literal(
        "i.id, m.source || ':' || m.kind AS type, m.source, m.content, i.created_at, i.read_at",
      )

      const findPage = SqlSchema.findAll({
        Request: Schema.Struct({
          userId: Schema.String,
          before: Schema.optional(Schema.Number),
          limit: Schema.Number,
          unreadOnly: Schema.Boolean,
        }),
        Result: ItemRow,
        execute: ({ userId, before, limit, unreadOnly }) => sql`
          SELECT ${columns}
          FROM inbox i JOIN messages m ON m.id = i.message_id
          WHERE ${sql.and([
            sql`i.user_id = ${userId}`,
            before === undefined ? sql.literal("true") : sql`i.id < ${before}`,
            unreadOnly ? sql.literal("i.read_at IS NULL") : sql.literal("true"),
          ])}
          ORDER BY i.id DESC
          LIMIT ${limit + 1}
        `,
      })
      const findForMessage = SqlSchema.findAll({
        Request: Schema.Number,
        Result: Schema.Struct({ userId: Schema.String, ...ItemRow.fields }),
        execute: (messageId) => sql`
          SELECT i.user_id, ${columns}
          FROM inbox i JOIN messages m ON m.id = i.message_id
          WHERE i.message_id = ${messageId}
        `,
      })

      const unread = (userId: string) =>
        sql<{ count: number }>`
          SELECT count(*)::int AS count FROM inbox WHERE user_id = ${userId} AND read_at IS NULL
        `.pipe(
          Effect.map(([row]) => row?.count ?? 0),
          Effect.orDie,
        )

      return Inbox.of({
        list: Effect.fn("Inbox.list")(function* (userId: string, query: InboxQuery) {
          const limit = Math.min(Math.max(query.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT)
          const rows = yield* findPage({
            userId,
            before: query.before,
            limit,
            unreadOnly: query.unreadOnly ?? false,
          }).pipe(Effect.orDie)
          const items = rows.slice(0, limit).map((row) => new InboxItem(row))
          const last = items.at(-1)
          return new InboxPage({
            items,
            unread: yield* unread(userId),
            nextCursor: rows.length > limit && last ? last.id : null,
          })
        }),

        unread,

        markRead: (userId, ids) =>
          ids.length === 0
            ? Effect.void
            : sql`
                UPDATE inbox SET read_at = now()
                WHERE user_id = ${userId} AND read_at IS NULL AND id IN ${sql.in(ids)}
              `.pipe(Effect.asVoid, Effect.orDie),

        markAllRead: (userId) =>
          sql`UPDATE inbox SET read_at = now() WHERE user_id = ${userId} AND read_at IS NULL`.pipe(
            Effect.asVoid,
            Effect.orDie,
          ),

        itemsForMessage: (messageId) =>
          findForMessage(messageId).pipe(
            Effect.map((rows) => rows.map(({ userId, ...item }) => ({ userId, item: new InboxItem(item) }))),
            Effect.orDie,
          ),
      })
    }),
  )
}
