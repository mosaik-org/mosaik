import { PgClient } from "@effect/sql-pg"
import { Conflict, type UserId } from "@mosaik/core"
import {
  Content,
  InboxCounts,
  InboxItem,
  InboxItemDetail,
  InboxKind,
  InboxPage,
  InboxState,
  InboxUpdate,
  Resolution,
  SourceCount,
} from "@mosaik/notifications/contract"
import { Array as Arr, Context, type DateTime, Effect, Layer, Option, Schema } from "effect"
import { SqlSchema } from "effect/sql"

const ItemRow = Schema.Struct({
  id: Schema.Number,
  userId: Schema.String,
  type: Schema.String,
  source: Schema.String,
  subject: Schema.NullOr(Schema.String),
  content: Content,
  action: Schema.Boolean,
  guarded: Schema.Boolean,
  state: InboxState,
  updates: Schema.Number,
  position: Schema.Number,
  createdAt: Schema.DateTimeUtcFromDate,
  updatedAt: Schema.DateTimeUtcFromDate,
  readAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
  snoozedUntil: Schema.NullOr(Schema.DateTimeUtcFromDate),
  resolvedAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
  resolvedVia: Schema.NullOr(Schema.Literals(["app", "person"])),
  resolvedById: Schema.NullOr(Schema.String),
  resolvedByName: Schema.NullOr(Schema.String),
})
type ItemRow = typeof ItemRow.Type

/** An item as people see it: whether they may resolve it, and who did. */
export const toItem = (row: ItemRow): InboxItem =>
  new InboxItem({
    id: row.id,
    type: row.type,
    source: row.source,
    subject: row.subject,
    content: row.content,
    action: row.action,
    // Information is the person's to clear; an action is unless only its app may resolve it.
    resolvable: !(row.action && row.guarded),
    state: row.state,
    updates: row.updates,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    readAt: row.readAt,
    snoozedUntil: row.state === "snoozed" ? row.snoozedUntil : null,
    resolution:
      row.resolvedAt === null
        ? null
        : new Resolution({
            at: row.resolvedAt,
            by:
              row.resolvedById === null
                ? null
                : { id: row.resolvedById as UserId, name: row.resolvedByName ?? row.resolvedById },
            app: row.resolvedVia === "app",
          }),
  })

/** Who handled something: a person, or the app that sent it (`null`). */
export interface Resolver {
  readonly id: string
  readonly name: string
}

/** A new notification's place in its people's inboxes. */
export interface Filing {
  readonly messageId: number
  readonly source: string
  readonly subject: string | null
  readonly action: boolean
  /** Only the app may resolve it. */
  readonly guarded: boolean
  readonly userIds: ReadonlyArray<string>
}

export interface UserItem {
  readonly userId: string
  readonly item: InboxItem
}

export interface InboxQuery {
  readonly state?: InboxState | undefined
  /** Of open items, one kind only; ignored for snoozed and resolved ones. */
  readonly kind?: InboxKind | undefined
  /** One app's items only. */
  readonly source?: string | undefined
  readonly before?: number | undefined
  readonly limit?: number | undefined
}

/** What a link from an e-mail or a Slack message leads to: where to go, and whether it is handled. */
export interface LinkTarget {
  readonly title: string
  readonly link: string | undefined
  readonly resolution: Option.Option<Resolution>
  /** The person's item about it, to mark read on the way. */
  readonly itemId: Option.Option<number>
}

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

/**
 * People's inboxes. Each person has at most one open item per subject, which later notifications about
 * it move on to the newest message; an item is open, snoozed until a time, or resolved (by its app, or
 * by the person where its type lets them).
 */
export class Inbox extends Context.Service<
  Inbox,
  {
    /** Adds a notification to its people's inboxes, or updates their open item about its subject. */
    file(filing: Filing): Effect.Effect<number>
    list(userId: string, query: InboxQuery): Effect.Effect<InboxPage>
    /** One of the person's items, with every notification it holds. */
    get(userId: string, id: number): Effect.Effect<Option.Option<InboxItemDetail>>
    counts(userId: string): Effect.Effect<InboxCounts>
    markRead(userId: string, ids: ReadonlyArray<number>): Effect.Effect<void>
    markAllRead(userId: string): Effect.Effect<void>
    /** The person resolves items; refuses all of them if only an app may resolve one. */
    resolve(user: Resolver, ids: ReadonlyArray<number>): Effect.Effect<void, Conflict>
    /** The person clears their open information (one app's, with `source`). Returns what it cleared. */
    resolveInformation(user: Resolver, source: string | undefined): Effect.Effect<ReadonlyArray<number>>
    /** Opens again what the person resolved or snoozed. */
    reopen(userId: string, ids: ReadonlyArray<number>): Effect.Effect<void>
    snooze(userId: string, ids: ReadonlyArray<number>, until: DateTime.Utc): Effect.Effect<void>
    /** An app handled what a subject is about: its open items are resolved. Returns whose. */
    resolveSubject(source: string, subject: string, by: Resolver | null): Effect.Effect<ReadonlyArray<string>>
    /** Opens what was snoozed until now, unread again. Returns their ids. */
    readonly wake: Effect.Effect<ReadonlyArray<number>>
    /** Removes what was resolved, and information read and left, before `cutoff`. */
    prune(cutoff: Date): Effect.Effect<number>
    /** The items one message is in, by user (for live updates). */
    itemsForMessage(messageId: number): Effect.Effect<ReadonlyArray<UserItem>>
    itemsByIds(ids: ReadonlyArray<number>): Effect.Effect<ReadonlyArray<UserItem>>
    /** Where a notification someone received leads, if it was theirs to receive. */
    linkTarget(userId: string, messageId: number): Effect.Effect<Option.Option<LinkTarget>>
  }
>()("@mosaik/notifications-service/Inbox") {
  static readonly layer = Layer.effect(
    Inbox,
    Effect.gen(function* () {
      const sql = yield* PgClient.PgClient
      const columns = sql.literal(`
        i.id, i.user_id, m.source || ':' || m.kind AS type, i.source, i.subject, m.content, i.action, i.guarded,
        CASE WHEN i.resolved_at IS NOT NULL THEN 'resolved'
          WHEN i.snoozed_until > now() THEN 'snoozed' ELSE 'open' END AS state,
        i.updates, i.position::float8 AS position, i.created_at, i.updated_at, i.read_at, i.snoozed_until,
        i.resolved_at, i.resolved_via, i.resolved_by_id, i.resolved_by_name`)
      const from = sql.literal("inbox i JOIN messages m ON m.id = i.message_id")
      const open = sql.literal("i.resolved_at IS NULL AND (i.snoozed_until IS NULL OR i.snoozed_until <= now())")
      const always = sql.literal("true")
      const inState = (state: InboxState) =>
        state === "resolved"
          ? sql.literal("i.resolved_at IS NOT NULL")
          : state === "snoozed"
            ? sql.literal("i.resolved_at IS NULL AND i.snoozed_until > now()")
            : open
      const ofKind = (state: InboxState, kind: InboxKind | undefined) =>
        state !== "open" || kind === undefined ? always : sql.literal(kind === "action" ? "i.action" : "NOT i.action")
      /** The person's items in a state (and kind): what a list shows before it is narrowed to an app. */
      const listed = (userId: string, state: InboxState, kind: InboxKind | undefined) =>
        sql.and([sql`i.user_id = ${userId}`, inState(state), ofKind(state, kind)])

      const Listing = {
        userId: Schema.String,
        state: InboxState,
        kind: Schema.optional(InboxKind),
      }
      const findPage = SqlSchema.findAll({
        Request: Schema.Struct({
          ...Listing,
          source: Schema.optional(Schema.String),
          before: Schema.optional(Schema.Number),
          limit: Schema.Number,
        }),
        Result: ItemRow,
        execute: ({ userId, state, kind, source, before, limit }) => sql`
          SELECT ${columns} FROM ${from}
          WHERE ${sql.and([
            listed(userId, state, kind),
            source === undefined ? always : sql`i.source = ${source}`,
            before === undefined ? always : sql`i.position < ${before}`,
          ])}
          ORDER BY i.position DESC
          LIMIT ${limit + 1}
        `,
      })
      const countBySource = SqlSchema.findAll({
        Request: Schema.Struct(Listing),
        Result: SourceCount,
        execute: ({ userId, state, kind }) => sql`
          SELECT i.source, count(*)::int AS count FROM inbox i
          WHERE ${listed(userId, state, kind)}
          GROUP BY i.source ORDER BY count DESC, i.source
        `,
      })
      const findHistory = SqlSchema.findAll({
        Request: Schema.Number,
        Result: Schema.Struct({
          id: Schema.Number,
          type: Schema.String,
          content: Content,
          at: Schema.DateTimeUtcFromDate,
        }),
        execute: (itemId) => sql`
          SELECT m.id, m.source || ':' || m.kind AS type, m.content, m.created_at AS at
          FROM inbox_messages im JOIN messages m ON m.id = im.message_id
          WHERE im.item_id = ${itemId}
          ORDER BY m.created_at DESC, m.id DESC
        `,
      })
      const findWhere = (where: ReturnType<typeof sql.literal> | ReturnType<typeof sql>) =>
        SqlSchema.findAll({
          Request: Schema.Void,
          Result: ItemRow,
          execute: () => sql`SELECT ${columns} FROM ${from} WHERE ${where}`,
        })

      const counts = (userId: string) =>
        sql<{ actions: number; information: number; unread: number }>`
          SELECT count(*) FILTER (WHERE i.action)::int AS actions,
            count(*) FILTER (WHERE NOT i.action)::int AS information,
            count(*) FILTER (WHERE i.read_at IS NULL)::int AS unread
          FROM inbox i WHERE i.user_id = ${userId} AND ${open}
        `.pipe(
          Effect.map(
            ([row]) =>
              new InboxCounts({
                actions: row?.actions ?? 0,
                information: row?.information ?? 0,
                unread: row?.unread ?? 0,
              }),
          ),
          Effect.orDie,
        )

      const withUsers = (rows: ReadonlyArray<ItemRow>): ReadonlyArray<UserItem> =>
        rows.map((row) => ({ userId: row.userId, item: toItem(row) }))
      const none = (ids: ReadonlyArray<number>) => !Arr.isReadonlyArrayNonEmpty(ids)

      return Inbox.of({
        file: Effect.fn("Inbox.file")(function* (filing: Filing) {
          const userIds = [...new Set(filing.userIds)]
          if (!Arr.isReadonlyArrayNonEmpty(userIds)) return 0
          const rows = Arr.map(userIds, (userId) => ({
            messageId: filing.messageId,
            userId,
            source: filing.source,
            subject: filing.subject,
            action: filing.action,
            guarded: filing.guarded,
          }))
          // A person's open item about the subject takes the newest message: it comes back to the top,
          // unread and awake, and stays an action (and guarded) if any of its notifications was. Each item
          // records the message too, as its history.
          yield* sql
            .withTransaction(
              Effect.gen(function* () {
                const filed = yield* sql<{ id: number }>`
                  INSERT INTO inbox ${sql.insert(rows)}
                  ON CONFLICT (user_id, source, subject) WHERE subject IS NOT NULL AND resolved_at IS NULL
                  DO UPDATE SET message_id = excluded.message_id, updates = inbox.updates + 1, updated_at = now(),
                    position = nextval('inbox_position'), read_at = NULL, snoozed_until = NULL,
                    action = inbox.action OR excluded.action, guarded = inbox.guarded OR excluded.guarded
                  RETURNING id
                `
                if (!Arr.isReadonlyArrayNonEmpty(filed)) return
                yield* sql`
                  INSERT INTO inbox_messages ${sql.insert(
                    Arr.map(filed, ({ id }) => ({ itemId: id, messageId: filing.messageId })),
                  )}
                  ON CONFLICT DO NOTHING
                `
              }),
            )
            .pipe(Effect.orDie)
          return userIds.length
        }),

        list: Effect.fn("Inbox.list")(function* (userId: string, query: InboxQuery) {
          const limit = Math.min(Math.max(query.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT)
          const state = query.state ?? "open"
          const [rows, sources, now] = yield* Effect.all(
            [
              findPage({ userId, state, kind: query.kind, source: query.source, before: query.before, limit }).pipe(
                Effect.orDie,
              ),
              countBySource({ userId, state, kind: query.kind }).pipe(Effect.orDie),
              counts(userId),
            ],
            { concurrency: "unbounded" },
          )
          const page = rows.slice(0, limit)
          const last = page.at(-1)
          return new InboxPage({
            items: page.map(toItem),
            counts: now,
            sources,
            nextCursor: rows.length > limit && last ? last.position : null,
          })
        }),

        get: Effect.fn("Inbox.get")(function* (userId: string, id: number) {
          const [row] = yield* findWhere(sql`i.user_id = ${userId} AND i.id = ${id}`)().pipe(Effect.orDie)
          if (row === undefined) return Option.none()
          const history = yield* findHistory(id).pipe(Effect.orDie)
          return Option.some(
            new InboxItemDetail({ item: toItem(row), history: history.map((update) => new InboxUpdate(update)) }),
          )
        }),

        counts,

        markRead: (userId, ids) =>
          none(ids)
            ? Effect.void
            : sql`
                UPDATE inbox SET read_at = now()
                WHERE user_id = ${userId} AND read_at IS NULL AND id IN ${sql.in(ids)}
              `.pipe(Effect.asVoid, Effect.orDie),

        markAllRead: (userId) =>
          sql`
            UPDATE inbox i SET read_at = now() WHERE i.user_id = ${userId} AND i.read_at IS NULL AND ${open}
          `.pipe(Effect.asVoid, Effect.orDie),

        resolve: Effect.fn("Inbox.resolve")(function* (user: Resolver, ids: ReadonlyArray<number>) {
          if (none(ids)) return
          const guarded = yield* sql<{ id: number }>`
            SELECT id FROM inbox
            WHERE user_id = ${user.id} AND id IN ${sql.in(ids)} AND resolved_at IS NULL AND action AND guarded
          `.pipe(Effect.orDie)
          if (guarded.length > 0) {
            return yield* new Conflict({
              message:
                "Only the app that sent it can resolve this, once what it is about is handled. You can snooze it.",
            })
          }
          yield* sql`
            UPDATE inbox SET resolved_at = now(), resolved_via = 'person', resolved_by_id = ${user.id},
              resolved_by_name = ${user.name}, snoozed_until = NULL, read_at = COALESCE(read_at, now())
            WHERE user_id = ${user.id} AND id IN ${sql.in(ids)} AND resolved_at IS NULL
          `.pipe(Effect.orDie)
        }),

        resolveInformation: (user, source) =>
          sql<{ id: number }>`
            UPDATE inbox i SET resolved_at = now(), resolved_via = 'person', resolved_by_id = ${user.id},
              resolved_by_name = ${user.name}, read_at = COALESCE(i.read_at, now())
            WHERE ${sql.and([
              sql`i.user_id = ${user.id}`,
              open,
              sql.literal("NOT i.action"),
              source === undefined ? always : sql`i.source = ${source}`,
            ])}
            RETURNING i.id
          `.pipe(
            Effect.map((rows) => rows.map((row) => row.id)),
            Effect.orDie,
            Effect.withSpan("Inbox.resolveInformation"),
          ),

        reopen: (userId, ids) =>
          none(ids)
            ? Effect.void
            : // Not if another item about the subject has opened since: that one is the open one.
              sql`
                UPDATE inbox i SET resolved_at = NULL, resolved_via = NULL, resolved_by_id = NULL,
                  resolved_by_name = NULL, snoozed_until = NULL
                WHERE i.user_id = ${userId} AND i.id IN ${sql.in(ids)}
                  AND (i.snoozed_until IS NOT NULL OR i.resolved_via = 'person')
                  AND NOT EXISTS (
                    SELECT 1 FROM inbox o
                    WHERE o.user_id = i.user_id AND o.source = i.source AND o.subject = i.subject
                      AND o.resolved_at IS NULL AND o.id <> i.id
                  )
              `.pipe(Effect.asVoid, Effect.orDie),

        snooze: (userId, ids, until) =>
          none(ids)
            ? Effect.void
            : sql`
                UPDATE inbox SET snoozed_until = ${new Date(until.epochMilliseconds)}
                WHERE user_id = ${userId} AND id IN ${sql.in(ids)} AND resolved_at IS NULL
              `.pipe(Effect.asVoid, Effect.orDie),

        resolveSubject: Effect.fn("Inbox.resolveSubject")(function* (
          source: string,
          subject: string,
          by: Resolver | null,
        ) {
          return yield* sql
            .withTransaction(
              Effect.gen(function* () {
                // Kept for those who got it only by e-mail or Slack, whose links show it.
                yield* sql`
                  INSERT INTO resolutions ${sql.insert({
                    source,
                    subject,
                    resolvedById: by?.id ?? null,
                    resolvedByName: by?.name ?? null,
                  })}
                  ON CONFLICT DO NOTHING
                `
                const rows = yield* sql<{ userId: string }>`
                  UPDATE inbox SET resolved_at = now(), resolved_via = 'app', resolved_by_id = ${by?.id ?? null},
                    resolved_by_name = ${by?.name ?? null}, snoozed_until = NULL
                  WHERE source = ${source} AND subject = ${subject} AND resolved_at IS NULL
                  RETURNING user_id
                `
                return rows.map((row) => row.userId)
              }),
            )
            .pipe(Effect.orDie)
        }),

        wake: sql<{ id: number }>`
          UPDATE inbox SET snoozed_until = NULL, read_at = NULL, position = nextval('inbox_position')
          WHERE snoozed_until <= now() AND resolved_at IS NULL
          RETURNING id
        `.pipe(
          Effect.map((rows) => rows.map((row) => row.id)),
          Effect.orDie,
          Effect.withSpan("Inbox.wake"),
        ),

        prune: (cutoff) =>
          Effect.gen(function* () {
            const [inbox] = yield* sql<{ removed: number }>`
              WITH removed AS (
                DELETE FROM inbox
                WHERE resolved_at < ${cutoff}
                  OR (NOT action AND resolved_at IS NULL AND read_at IS NOT NULL AND updated_at < ${cutoff})
                RETURNING 1
              )
              SELECT count(*)::int AS removed FROM removed
            `
            yield* sql`DELETE FROM resolutions WHERE resolved_at < ${cutoff}`
            return inbox?.removed ?? 0
          }).pipe(Effect.orDie, Effect.withSpan("Inbox.prune")),

        itemsForMessage: (messageId) =>
          findWhere(sql`i.message_id = ${messageId}`)().pipe(Effect.map(withUsers), Effect.orDie),

        itemsByIds: (ids) =>
          none(ids)
            ? Effect.succeed([])
            : findWhere(sql`i.id IN ${sql.in(ids)}`)().pipe(Effect.map(withUsers), Effect.orDie),

        linkTarget: Effect.fn("Inbox.linkTarget")(function* (userId: string, messageId: number) {
          const [message] = yield* sql<{
            source: string
            subject: string | null
            title: string
            link: string | null
            createdAt: Date
            received: boolean
          }>`
            SELECT m.source, m.subject, m.content ->> 'title' AS title, m.content ->> 'link' AS link, m.created_at,
              EXISTS (SELECT 1 FROM deliveries d WHERE d.message_id = m.id AND d.recipient_user_id = ${userId})
                OR EXISTS (SELECT 1 FROM inbox i WHERE i.message_id = m.id AND i.user_id = ${userId})
                OR EXISTS (
                  SELECT 1 FROM inbox i
                  WHERE i.user_id = ${userId} AND i.source = m.source AND i.subject = m.subject
                ) AS received
            FROM messages m WHERE m.id = ${messageId} AND m.category = 'notification'
          `.pipe(Effect.orDie)
          if (message === undefined || !message.received) return Option.none()
          const link = message.link ?? undefined
          const title = message.title
          if (message.subject === null) {
            return Option.some({ title, link, resolution: Option.none(), itemId: Option.none() })
          }
          // The person's own item about the subject says the most; failing that, what the app resolved
          // since this notification was sent.
          const [item] = yield* findWhere(
            sql`i.user_id = ${userId} AND i.source = ${message.source} AND i.subject = ${message.subject}
              ORDER BY i.position DESC LIMIT 1`,
          )().pipe(Effect.orDie)
          if (item !== undefined) {
            const resolved = toItem(item).resolution
            return Option.some({
              title,
              link,
              resolution: Option.fromNullishOr(resolved),
              itemId: Option.some(item.id),
            })
          }
          const [resolved] = yield* sql<{
            resolvedAt: Date
            resolvedById: string | null
            resolvedByName: string | null
          }>`
            SELECT resolved_at, resolved_by_id, resolved_by_name FROM resolutions
            WHERE source = ${message.source} AND subject = ${message.subject} AND resolved_at >= ${message.createdAt}
            ORDER BY resolved_at DESC LIMIT 1
          `.pipe(Effect.orDie)
          return Option.some({
            title,
            link,
            itemId: Option.none(),
            resolution:
              resolved === undefined
                ? Option.none()
                : Option.some(
                    yield* Schema.decodeUnknownEffect(Resolution)({
                      at: resolved.resolvedAt.toISOString(),
                      by:
                        resolved.resolvedById === null
                          ? null
                          : { id: resolved.resolvedById, name: resolved.resolvedByName ?? resolved.resolvedById },
                      app: true,
                    }).pipe(Effect.orDie),
                  ),
          })
        }),
      })
    }),
  )
}
