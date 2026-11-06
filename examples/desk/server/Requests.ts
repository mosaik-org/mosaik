import { NotFound } from "@mosaik/sdk"
import { Context, DateTime, Effect, Layer, Option, Schema } from "effect"
import { SqlClient, type SqlError, SqlSchema } from "effect/sql"
import {
  type ActivityKind,
  type ChangedField,
  DeskRequest,
  nextDue,
  type QueueId,
  type RequestId,
  type RequestStatus,
} from "../api"

/** Which requests. What is left out does not narrow them. */
export interface RequestFilter {
  /** Assigned to them, or to nobody. */
  readonly inboxOf?: string | undefined
  readonly requesterId?: string | undefined
  readonly statuses?: ReadonlyArray<RequestStatus> | undefined
  readonly queueId?: QueueId | undefined
  readonly search?: string | undefined
}

/** `urgency`: what is due first, then what has no deadline running. `recent`: the latest activity first. */
export type RequestOrder = "urgency" | "recent"

/** A request before it has an id. */
export type NewStoredRequest = Omit<ConstructorParameters<typeof DeskRequest>[0], "id">

/** A line for a request's story. */
export interface NewActivity {
  readonly kind: ActivityKind
  readonly authorId: string | null
  readonly body?: string | null
  readonly field?: ChangedField | null
  readonly from?: string | null
  readonly to?: string | null
  readonly createdAt: DateTime.Utc
}

export interface StoredActivity extends NewActivity {
  readonly id: number
  readonly requestId: RequestId
}

export interface PersonCount {
  readonly personId: string
  readonly count: number
}

/** The requests and their stories, as they are kept. What they mean is in `Desk` and in `api/rules`. */
export class Requests extends Context.Service<
  Requests,
  {
    get(id: RequestId): Effect.Effect<DeskRequest, NotFound>
    list(filter: RequestFilter, order: RequestOrder, limit: number): Effect.Effect<ReadonlyArray<DeskRequest>>
    count(filter: RequestFilter): Effect.Effect<number>
    countByQueue(
      filter: RequestFilter,
    ): Effect.Effect<ReadonlyArray<{ readonly queueId: QueueId; readonly count: number }>>
    insert(request: NewStoredRequest, activity: NewActivity): Effect.Effect<DeskRequest>
    /** Changes a request and adds to its story as one: nothing else changes it in between. */
    edit<E>(
      id: RequestId,
      change: (
        request: DeskRequest,
      ) => Effect.Effect<{ readonly request: DeskRequest; readonly activity: ReadonlyArray<NewActivity> }, E>,
    ): Effect.Effect<DeskRequest, NotFound | E>
    remove(id: RequestId): Effect.Effect<void, NotFound>

    activity(id: RequestId, options: { readonly notes: boolean }): Effect.Effect<ReadonlyArray<StoredActivity>>

    /** When a person last saw each of these requests. */
    readTimes(personId: string, ids: ReadonlyArray<RequestId>): Effect.Effect<ReadonlyMap<RequestId, DateTime.Utc>>
    markRead(personId: string, id: RequestId, at: DateTime.Utc): Effect.Effect<void>

    /** What is assigned to someone, for telling them what waits. */
    assignedTo(personId: string): Effect.Effect<ReadonlyArray<DeskRequest>>
    /** Past their deadline, with nobody told of that deadline yet. */
    overdueToTell(now: DateTime.Utc): Effect.Effect<ReadonlyArray<DeskRequest>>
    markOverdueTold(id: RequestId, due: DateTime.Utc): Effect.Effect<void>
    solvedBefore(at: DateTime.Utc): Effect.Effect<ReadonlyArray<DeskRequest>>

    /** For each person, what is theirs to do. */
    yourMoveByAssignee: Effect.Effect<ReadonlyArray<PersonCount>>
    /** For each person, what waits for their answer. */
    waitingByRequester: Effect.Effect<ReadonlyArray<PersonCount>>
    overdueCount(now: DateTime.Utc): Effect.Effect<number>
  }
>()("@mosaik/desk/Requests") {
  static readonly layer = Layer.effect(
    Requests,
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient

      const OptionalDate = Schema.NullOr(Schema.DateTimeUtcFromDate)
      const Row = Schema.Struct({
        ...DeskRequest.fields,
        createdAt: Schema.DateTimeUtcFromDate,
        updatedAt: Schema.DateTimeUtcFromDate,
        respondBy: Schema.DateTimeUtcFromDate,
        resolveBy: Schema.DateTimeUtcFromDate,
        firstRepliedAt: OptionalDate,
        solvedAt: OptionalDate,
        pausedAt: OptionalDate,
        lastActivityAt: Schema.DateTimeUtcFromDate,
      })

      const columns = sql.literal(
        "id, title, body, queue_id, priority, status, requester_id, assignee_id, created_at, updated_at, " +
          "respond_by, resolve_by, first_replied_at, solved_at, paused_at, paused_seconds, last_activity_at, last_activity_by",
      )

      const date = (at: DateTime.Utc) => DateTime.toDateUtc(at)
      const optionalDate = (at: DateTime.Utc | null) => (at === null ? null : date(at))
      const dueOf = (request: Parameters<typeof nextDue>[0]) => {
        const due = nextDue(request)
        return due === undefined ? null : date(due.at)
      }

      const where = (filter: RequestFilter) => {
        const number = filter.search?.match(/^(?:req-)?(\d+)$/i)?.[1]
        const words = `%${filter.search}%`
        return sql.and([
          filter.inboxOf === undefined
            ? sql.literal("true")
            : sql`(assignee_id = ${filter.inboxOf} OR assignee_id IS NULL)`,
          filter.requesterId === undefined ? sql.literal("true") : sql`requester_id = ${filter.requesterId}`,
          filter.statuses === undefined ? sql.literal("true") : sql`status IN ${sql.in(filter.statuses)}`,
          filter.queueId === undefined ? sql.literal("true") : sql`queue_id = ${filter.queueId}`,
          filter.search
            ? number !== undefined
              ? sql`id = ${Number(number)}`
              : sql`(title ILIKE ${words} OR body ILIKE ${words}
                    OR requester_id IN (SELECT id FROM people WHERE name ILIKE ${words}))`
            : sql.literal("true"),
        ])
      }

      const rows = (execute: () => Effect.Effect<ReadonlyArray<unknown>, SqlError.SqlError>) =>
        SqlSchema.findAll({ Request: Schema.Void, Result: Row, execute })().pipe(
          Effect.orDie,
          Effect.map((found) => found.map((row) => new DeskRequest(row))),
        )

      const addActivity = (requestId: number, line: NewActivity) => sql`
        INSERT INTO activity (request_id, kind, author_id, body, field, from_value, to_value, created_at)
        VALUES (${requestId}, ${line.kind}, ${line.authorId}, ${line.body ?? null}, ${line.field ?? null},
                ${line.from ?? null}, ${line.to ?? null}, ${date(line.createdAt)})
      `

      const findForUpdate = SqlSchema.findOneOption({
        Request: Schema.Number,
        Result: Row,
        execute: (id) => sql`SELECT ${columns} FROM requests WHERE id = ${id} FOR UPDATE`,
      })

      const find = SqlSchema.findOneOption({
        Request: Schema.Number,
        Result: Row,
        execute: (id) => sql`SELECT ${columns} FROM requests WHERE id = ${id}`,
      })

      const save = (request: DeskRequest) => sql`
        UPDATE requests SET
          title = ${request.title}, body = ${request.body}, queue_id = ${request.queueId},
          priority = ${request.priority}, status = ${request.status}, assignee_id = ${request.assigneeId},
          updated_at = ${date(request.updatedAt)}, respond_by = ${date(request.respondBy)},
          resolve_by = ${date(request.resolveBy)}, first_replied_at = ${optionalDate(request.firstRepliedAt)},
          solved_at = ${optionalDate(request.solvedAt)}, paused_at = ${optionalDate(request.pausedAt)},
          paused_seconds = ${request.pausedSeconds}, last_activity_at = ${date(request.lastActivityAt)},
          last_activity_by = ${request.lastActivityBy}, next_due_at = ${dueOf(request)}
        WHERE id = ${request.id}
      `

      const ActivityRow = Schema.Struct({
        id: Schema.Int,
        requestId: Schema.Int,
        kind: Schema.String,
        authorId: Schema.NullOr(Schema.String),
        body: Schema.NullOr(Schema.String),
        field: Schema.NullOr(Schema.String),
        fromValue: Schema.NullOr(Schema.String),
        toValue: Schema.NullOr(Schema.String),
        createdAt: Schema.DateTimeUtcFromDate,
      })

      const personCounts = (query: ReturnType<typeof sql<PersonCount>>) =>
        query.pipe(Effect.orDie) as Effect.Effect<ReadonlyArray<PersonCount>>

      return Requests.of({
        get: Effect.fn("Requests.get")(function* (id: RequestId) {
          const row = yield* find(id).pipe(Effect.orDie)
          if (Option.isNone(row)) return yield* new NotFound({ resource: "request", id: String(id) })
          return new DeskRequest(row.value)
        }),

        list: (filter, order, limit) =>
          rows(() => {
            const sort =
              order === "urgency"
                ? sql.literal("next_due_at ASC NULLS LAST, last_activity_at DESC, id DESC")
                : sql.literal("last_activity_at DESC, id DESC")
            return sql`SELECT ${columns} FROM requests WHERE ${where(filter)} ORDER BY ${sort} LIMIT ${limit}`
          }),

        count: (filter) =>
          sql<{ total: number }>`SELECT count(*)::int AS total FROM requests WHERE ${where(filter)}`.pipe(
            Effect.orDie,
            Effect.map(([row]) => row?.total ?? 0),
          ),

        countByQueue: (filter) =>
          sql<{ queueId: QueueId; count: number }>`
            SELECT queue_id, count(*)::int AS count FROM requests WHERE ${where(filter)} GROUP BY queue_id
          `.pipe(Effect.orDie),

        insert: (request, activity) =>
          sql
            .withTransaction(
              Effect.gen(function* () {
                const [created] = yield* sql<{ id: number }>`
                  INSERT INTO requests (title, body, queue_id, priority, status, requester_id, assignee_id,
                    created_at, updated_at, respond_by, resolve_by, first_replied_at, solved_at, paused_at,
                    paused_seconds, last_activity_at, last_activity_by, next_due_at)
                  VALUES (${request.title}, ${request.body}, ${request.queueId}, ${request.priority},
                    ${request.status}, ${request.requesterId}, ${request.assigneeId}, ${date(request.createdAt)},
                    ${date(request.updatedAt)}, ${date(request.respondBy)}, ${date(request.resolveBy)},
                    ${optionalDate(request.firstRepliedAt)}, ${optionalDate(request.solvedAt)},
                    ${optionalDate(request.pausedAt)}, ${request.pausedSeconds}, ${date(request.lastActivityAt)},
                    ${request.lastActivityBy}, ${dueOf(request)})
                  RETURNING id
                `
                if (created === undefined) return yield* Effect.die("INSERT returned nothing")
                yield* addActivity(created.id, activity)
                const row = yield* find(created.id)
                return yield* Option.match(row, {
                  onNone: () => Effect.die("A request just made is gone"),
                  onSome: (value) => Effect.succeed(new DeskRequest(value)),
                })
              }),
            )
            .pipe(Effect.orDie),

        edit: (id, change) =>
          sql
            .withTransaction(
              Effect.gen(function* () {
                const row = yield* findForUpdate(id).pipe(Effect.orDie)
                if (Option.isNone(row)) return yield* new NotFound({ resource: "request", id: String(id) })
                const { request, activity } = yield* change(new DeskRequest(row.value))
                yield* save(request).pipe(Effect.orDie)
                for (const line of activity) yield* addActivity(id, line).pipe(Effect.orDie)
                return request
              }),
            )
            .pipe(Effect.catchTag("SqlError", (error) => Effect.die(error))),

        remove: Effect.fn("Requests.remove")(function* (id: RequestId) {
          const deleted = yield* sql<{ id: number }>`DELETE FROM requests WHERE id = ${id} RETURNING id`.pipe(
            Effect.orDie,
          )
          if (deleted.length === 0) return yield* new NotFound({ resource: "request", id: String(id) })
        }),

        activity: (id, { notes }) =>
          SqlSchema.findAll({
            Request: Schema.Void,
            Result: ActivityRow,
            execute: () => sql`
              SELECT id, request_id, kind, author_id, body, field, from_value, to_value, created_at
              FROM activity
              WHERE request_id = ${id} AND ${notes ? sql.literal("true") : sql.literal("kind <> 'note'")}
              ORDER BY id
            `,
          })().pipe(
            Effect.orDie,
            Effect.map((found) =>
              found.map(
                (row): StoredActivity => ({
                  id: row.id,
                  requestId: row.requestId as RequestId,
                  kind: row.kind as ActivityKind,
                  authorId: row.authorId,
                  body: row.body,
                  field: row.field as ChangedField | null,
                  from: row.fromValue,
                  to: row.toValue,
                  createdAt: row.createdAt,
                }),
              ),
            ),
          ),

        readTimes: (personId, ids) =>
          ids.length === 0
            ? Effect.succeed(new Map())
            : SqlSchema.findAll({
                Request: Schema.Void,
                Result: Schema.Struct({ requestId: Schema.Int, readAt: Schema.DateTimeUtcFromDate }),
                execute: () => sql`
                  SELECT request_id, read_at FROM request_reads
                  WHERE person_id = ${personId} AND request_id IN ${sql.in(ids)}
                `,
              })().pipe(
                Effect.orDie,
                Effect.map((found) => new Map(found.map((row) => [row.requestId as RequestId, row.readAt]))),
              ),

        markRead: (personId, id, at) =>
          sql`
            INSERT INTO request_reads (request_id, person_id, read_at) VALUES (${id}, ${personId}, ${date(at)})
            ON CONFLICT (request_id, person_id) DO UPDATE SET read_at = excluded.read_at
          `.pipe(Effect.asVoid, Effect.orDie),

        assignedTo: (personId) =>
          rows(() => sql`SELECT ${columns} FROM requests WHERE assignee_id = ${personId} AND status <> 'closed'`),

        overdueToTell: (now) =>
          rows(
            () => sql`
              SELECT ${columns} FROM requests
              WHERE next_due_at < ${date(now)} AND overdue_notified_for IS DISTINCT FROM next_due_at
            `,
          ),

        markOverdueTold: (id, due) =>
          sql`UPDATE requests SET overdue_notified_for = ${date(due)} WHERE id = ${id}`.pipe(
            Effect.asVoid,
            Effect.orDie,
          ),

        solvedBefore: (at) =>
          rows(() => sql`SELECT ${columns} FROM requests WHERE status = 'solved' AND solved_at < ${date(at)}`),

        yourMoveByAssignee: personCounts(sql<PersonCount>`
          SELECT assignee_id AS person_id, count(*)::int AS count FROM requests
          WHERE assignee_id IS NOT NULL AND status IN ('new', 'open') GROUP BY assignee_id
        `),

        waitingByRequester: personCounts(sql<PersonCount>`
          SELECT requester_id AS person_id, count(*)::int AS count FROM requests
          WHERE status = 'waiting' GROUP BY requester_id
        `),

        overdueCount: (now) =>
          sql<{ total: number }>`SELECT count(*)::int AS total FROM requests WHERE next_due_at < ${date(now)}`.pipe(
            Effect.orDie,
            Effect.map(([row]) => row?.total ?? 0),
          ),
      })
    }),
  )
}
