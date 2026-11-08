import { BadRequest, Conflict, NotFound, type Principal, UserId } from "@mosaik/sdk"
import { Audiences, Audit, Notify } from "@mosaik/sdk/server"
import { Context, DateTime, Effect, Layer } from "effect"
import {
  ACTIVE_STATUSES,
  Activity,
  applyChange,
  applyNote,
  applyReply,
  type ChangedField,
  changedFields,
  changeProblem,
  type DeskRequest,
  DONE_STATUSES,
  deadlinesFor,
  EditResult,
  inverseChange,
  type NewReply,
  type NewRequest,
  PRIORITY_LABELS,
  type Queue,
  QueueCount,
  REQUESTS_PAGE,
  type RequestEdits,
  type RequestId,
  RequestRow,
  type RequestStatus,
  RequestsPage,
  type RequestsQuery,
  requesterMay,
  requesterMayDelete,
  requestNumber,
  STATUS_LABELS,
  YOUR_MOVE_STATUSES,
} from "../api"
import { desk } from "../manifest"
import { Changes } from "./Changes"
import { isAgent, nameless, People, personOf } from "./People"
import { type NewActivity, type RequestFilter, type RequestOrder, Requests } from "./Requests"
import { Setup } from "./Setup"
import { Statuses } from "./Statuses"
import { handlerSubject, requesterSubject } from "./subjects"

/** Everything people do with requests: who may, what follows, and who hears of it. */
/** Solved or closed: nothing left for whoever handles it. */
const isDone = (status: RequestStatus) => DONE_STATUSES.includes(status)

export class Desk extends Context.Service<
  Desk,
  {
    list(principal: Principal, query: RequestsQuery): Effect.Effect<RequestsPage>
    get(principal: Principal, id: RequestId): Effect.Effect<RequestRow, NotFound>
    create(principal: Principal, input: NewRequest): Effect.Effect<RequestRow, BadRequest>
    edit(principal: Principal, input: RequestEdits): Effect.Effect<EditResult, NotFound | BadRequest | Conflict>
    remove(principal: Principal, id: RequestId): Effect.Effect<void, NotFound | Conflict>
    activity(principal: Principal, id: RequestId): Effect.Effect<ReadonlyArray<Activity>, NotFound>
    reply(principal: Principal, id: RequestId, input: NewReply): Effect.Effect<RequestRow, NotFound | Conflict>
    markRead(principal: Principal, id: RequestId): Effect.Effect<void, NotFound>
    /** Whether the principal may see this request: they asked, or they work on requests. Hides the others as missing. */
    visible(principal: Principal, id: RequestId): Effect.Effect<DeskRequest, NotFound>
  }
>()("@mosaik/desk/Desk") {
  static readonly layer = Layer.effect(
    Desk,
    Effect.gen(function* () {
      const requests = yield* Requests
      const people = yield* People
      const setup = yield* Setup
      const changes = yield* Changes
      const statuses = yield* Statuses
      const audit = yield* Audit
      const notify = yield* Notify

      /** What everyone sees after a change: lists refetch, counts follow. */
      const settle = (ids: ReadonlyArray<RequestId>) => Effect.andThen(changes.publish(ids), statuses.recount)

      const toRows = Effect.fn("Desk.toRows")(function* (
        viewerId: string,
        agent: boolean,
        found: ReadonlyArray<DeskRequest>,
      ) {
        const [known, queues, reads] = yield* Effect.all(
          [
            people.byIds([
              ...new Set(
                found.flatMap((request) => [request.requesterId, request.assigneeId].flatMap((id) => id ?? [])),
              ),
            ]),
            setup.queues,
            requests.readTimes(
              viewerId,
              found.map((request) => request.id),
            ),
          ],
          { concurrency: 3 },
        )
        const queueNames = new Map(queues.map((queue) => [queue.id, queue.name]))
        return found.map((request) => {
          const readAt = reads.get(request.id)
          const newer =
            request.lastActivityBy !== viewerId &&
            (readAt === undefined || DateTime.isGreaterThan(request.lastActivityAt, readAt))
          return new RequestRow({
            ...request,
            requester: known.get(request.requesterId) ?? nameless(request.requesterId),
            assignee:
              request.assigneeId === null ? null : (known.get(request.assigneeId) ?? nameless(request.assigneeId)),
            queueName: queueNames.get(request.queueId) ?? "",
            // Someone who asked does not see notes, so only an answer is news to them.
            unread: newer && (agent || request.status === "waiting" || request.status === "solved"),
          })
        })
      })

      const toRow = (principal: Principal, request: DeskRequest) =>
        toRows(personOf(principal).id, isAgent(principal), [request]).pipe(Effect.map(([row]) => row as RequestRow))

      const visible = (principal: Principal, id: RequestId) =>
        Effect.gen(function* () {
          const request = yield* requests.get(id)
          if (!isAgent(principal) && request.requesterId !== personOf(principal).id) {
            return yield* new NotFound({ resource: "request", id: String(id) })
          }
          return request
        })

      /** Which requests a view is, for this person: someone who does not work on requests only ever gets theirs. */
      const filterFor = (
        principal: Principal,
        query: RequestsQuery,
      ): { filter: RequestFilter; order: RequestOrder } => {
        const me = personOf(principal).id
        const view = !isAgent(principal) ? "mine" : query.view
        const shared = { queueId: query.queue, search: query.search }
        const byState = query.state === "done" ? DONE_STATUSES : query.state === "active" ? ACTIVE_STATUSES : undefined
        switch (view) {
          case "inbox":
            return { filter: { ...shared, inboxOf: me, statuses: YOUR_MOVE_STATUSES }, order: "urgency" }
          case "all":
            return {
              filter: { ...shared, statuses: byState ?? ACTIVE_STATUSES },
              order: query.state === "done" ? "recent" : "urgency",
            }
          case "visible":
            return { filter: { ...shared, statuses: byState }, order: "recent" }
          default:
            return { filter: { ...shared, requesterId: me, statuses: byState }, order: "recent" }
        }
      }

      const wordsFor = (
        field: ChangedField,
        request: DeskRequest,
        queues: ReadonlyArray<Queue>,
        names: ReadonlyMap<string, string>,
      ) => {
        switch (field) {
          case "title":
            return request.title
          case "body":
            return null
          case "queue":
            return queues.find((queue) => queue.id === request.queueId)?.name ?? null
          case "priority":
            return PRIORITY_LABELS[request.priority]
          case "status":
            return STATUS_LABELS[request.status]
          case "assignee":
            return request.assigneeId === null ? null : (names.get(request.assigneeId) ?? null)
        }
      }

      /**
       * The request no longer needs whoever was told about it: it is solved, gone or someone else's. Their
       * items about it (being given it, its deadline) are resolved, wherever they are.
       */
      const handled = (id: RequestId, actorId: string) =>
        notify.resolve(handlerSubject(id), { by: UserId.make(actorId) }).pipe(Effect.ignore)

      const notifyAssigned = (request: DeskRequest, actorId: string, actorName: string) =>
        request.assigneeId === null || request.assigneeId === actorId
          ? Effect.void
          : notify
              .send({
                type: desk.notification("request.assigned"),
                audience: Audiences.users(UserId.make(request.assigneeId)),
                subject: handlerSubject(request.id),
                content: {
                  title: `${requestNumber(request.id)} is yours: ${request.title}`,
                  body: `${actorName} gave it to you.`,
                  link: `/desk?open=${request.id}`,
                  linkLabel: "Open request",
                },
                idempotencyKey: `assigned-${request.id}-${DateTime.toEpochMillis(request.updatedAt)}`,
              })
              .pipe(Effect.ignore)

      return Desk.of({
        visible,

        list: Effect.fn("Desk.list")(function* (principal: Principal, query: RequestsQuery) {
          yield* people.remember(principal)
          const { filter, order } = filterFor(principal, query)
          const { queueId: _, ...everyQueue } = filter
          const [found, total, byQueue] = yield* Effect.all(
            [
              requests.list(filter, order, query.limit ?? REQUESTS_PAGE),
              requests.count(filter),
              requests.countByQueue(everyQueue),
            ],
            { concurrency: 3 },
          )
          return new RequestsPage({
            rows: yield* toRows(personOf(principal).id, isAgent(principal), found),
            total,
            byQueue: byQueue.map((count) => new QueueCount(count)),
          })
        }),

        get: Effect.fn("Desk.get")(function* (principal: Principal, id: RequestId) {
          yield* people.remember(principal)
          return yield* toRow(principal, yield* visible(principal, id))
        }),

        create: Effect.fn("Desk.create")(function* (principal: Principal, input: NewRequest) {
          const me = yield* people.remember(principal)
          const queues = yield* setup.queues
          if (!queues.some((queue) => queue.id === input.queueId)) {
            return yield* new BadRequest({ message: "That queue is gone. Choose another one." })
          }
          const now = yield* DateTime.now
          const rule = yield* setup.deadline(input.priority)
          const created = yield* requests.insert(
            {
              title: input.title,
              body: input.body,
              queueId: input.queueId,
              priority: input.priority,
              status: "new",
              requesterId: me.id,
              assigneeId: null,
              createdAt: now,
              updatedAt: now,
              ...deadlinesFor(now, rule, 0),
              firstRepliedAt: null,
              solvedAt: null,
              pausedAt: null,
              pausedSeconds: 0,
              lastActivityAt: now,
              lastActivityBy: me.id,
            },
            { kind: "created", authorId: me.id, createdAt: now },
          )
          yield* audit.record({ action: "requests.create", target: requestNumber(created.id) })
          yield* settle([created.id])
          return yield* toRow(principal, created)
        }),

        edit: Effect.fn("Desk.edit")(function* (principal: Principal, input: RequestEdits) {
          const me = yield* people.remember(principal)
          const agent = isAgent(principal)
          const queues = yield* setup.queues
          const now = yield* DateTime.now
          const results: Array<{ readonly before: DeskRequest; readonly after: DeskRequest }> = []

          for (const { id, change } of input.edits) {
            if (change.assigneeId !== undefined && change.assigneeId !== null) {
              if (!(yield* people.isAgent(change.assigneeId))) {
                return yield* new BadRequest({ message: "That person does not work on requests." })
              }
            }
            if (change.queueId !== undefined && !queues.some((queue) => queue.id === change.queueId)) {
              return yield* new BadRequest({ message: "That queue is gone. Choose another one." })
            }
            let before: DeskRequest | undefined
            const after = yield* requests.edit(id, (request) =>
              Effect.gen(function* () {
                before = request
                const own = request.requesterId === me.id
                // Hidden as missing unless they may see it; what they may not do is said in words.
                if (!agent && !own) return yield* new NotFound({ resource: "request", id: String(id) })
                if (!agent && !requesterMay(change)) {
                  return yield* new Conflict({ message: "Only people who work on requests can change that." })
                }
                const problem = changeProblem(request, change)
                if (problem !== undefined) return yield* new Conflict({ message: problem })
                const rule = yield* setup.deadline(change.priority ?? request.priority)
                const next = applyChange(request, change, rule, me.id, now)
                const fields = changedFields(request, next)
                const names = new Map(
                  [...(yield* people.byIds([request.assigneeId, next.assigneeId].flatMap((one) => one ?? [])))].map(
                    ([key, person]) => [key, person.name] as const,
                  ),
                )
                const activity = fields.map(
                  (field): NewActivity => ({
                    kind: "change",
                    authorId: me.id,
                    field,
                    from: wordsFor(field, request, queues, names),
                    to: wordsFor(field, next, queues, names),
                    createdAt: now,
                  }),
                )
                // Nothing moved: nothing happened, so it does not show as news either.
                return { request: fields.length === 0 ? request : next, activity }
              }),
            )
            if (before !== undefined) results.push({ before, after })
          }

          for (const { before, after } of results) {
            yield* audit.record({
              action: "requests.edit",
              target: requestNumber(after.id),
              details: { fields: changedFields(before, after) },
            })
            if (isDone(after.status) && !isDone(before.status)) yield* handled(after.id, me.id)
            else if (before.assigneeId !== after.assigneeId) {
              // Whoever had it before is done with it; whoever has it now is told.
              yield* handled(after.id, me.id)
              yield* notifyAssigned(after, me.id, me.name)
            }
          }
          yield* settle(results.map(({ after }) => after.id))
          return new EditResult({
            rows: yield* toRows(
              me.id,
              agent,
              results.map(({ after }) => after),
            ),
            undo: results.map(({ before, after }) => ({ id: after.id, change: inverseChange(before, after) })),
          })
        }),

        remove: Effect.fn("Desk.remove")(function* (principal: Principal, id: RequestId) {
          const request = yield* visible(principal, id)
          const own = request.requesterId === personOf(principal).id
          if (!principal.can(desk.perm("requests.delete")) && !(own && requesterMayDelete(request))) {
            return yield* new Conflict({
              message: own
                ? "Someone has picked this up, so it can't be deleted any more. Mark it solved instead."
                : "Only leads can delete requests.",
            })
          }
          yield* requests.remove(id)
          yield* handled(id, personOf(principal).id)
          yield* audit.record({
            action: "requests.delete",
            target: requestNumber(id),
            details: { title: request.title },
          })
          yield* settle([id])
        }),

        activity: Effect.fn("Desk.activity")(function* (principal: Principal, id: RequestId) {
          yield* visible(principal, id)
          const lines = yield* requests.activity(id, { notes: isAgent(principal) })
          const authors = yield* people.byIds([...new Set(lines.flatMap((line) => line.authorId ?? []))])
          return lines.map(
            (line) =>
              new Activity({
                id: line.id,
                requestId: line.requestId,
                kind: line.kind,
                author: line.authorId === null ? null : (authors.get(line.authorId) ?? nameless(line.authorId)),
                body: line.body ?? null,
                field: line.field ?? null,
                from: line.from ?? null,
                to: line.to ?? null,
                createdAt: line.createdAt,
              }),
          )
        }),

        reply: Effect.fn("Desk.reply")(function* (principal: Principal, id: RequestId, input: NewReply) {
          const me = yield* people.remember(principal)
          const agent = isAgent(principal)
          const now = yield* DateTime.now
          const after = yield* requests.edit(id, (request) =>
            Effect.gen(function* () {
              const own = request.requesterId === me.id
              if (!agent && !own) return yield* new NotFound({ resource: "request", id: String(id) })
              if (request.status === "closed") {
                return yield* new Conflict({ message: "This request is closed. Send a new one instead." })
              }
              if (input.kind === "note") {
                if (!agent) return yield* new Conflict({ message: "Only people who work on requests can add notes." })
                return {
                  request: applyNote(request, me.id, now),
                  activity: [{ kind: "note", authorId: me.id, body: input.body, createdAt: now } satisfies NewActivity],
                }
              }
              // Someone who works on requests, answering their own, is the person asking.
              const by = agent && !own ? ("agent" as const) : ("requester" as const)
              return {
                request: applyReply(request, { by, actorId: me.id, solve: input.solve }, now),
                activity: [{ kind: "reply", authorId: me.id, body: input.body, createdAt: now } satisfies NewActivity],
              }
            }),
          )
          yield* requests.markRead(me.id, id, now)
          yield* audit.record({ action: `requests.${input.kind}`, target: requestNumber(id) })

          const toRequester = input.kind === "reply" && after.requesterId !== me.id
          const toAssignee = after.assigneeId !== null && after.assigneeId !== me.id && !toRequester
          if (toRequester || toAssignee) {
            yield* notify
              .send({
                type: desk.notification("request.replied"),
                audience: Audiences.users(UserId.make(toRequester ? after.requesterId : (after.assigneeId as string))),
                // For the person asking, the conversation; for whoever has it, one more thing about their item.
                subject: toRequester ? requesterSubject(id) : handlerSubject(id),
                content: {
                  title: `${me.name} on ${requestNumber(id)}: ${after.title}`,
                  body: input.body,
                  link: toRequester ? `/desk/mine?open=${id}` : `/desk?open=${id}`,
                  linkLabel: "Open request",
                },
                idempotencyKey: `reply-${id}-${DateTime.toEpochMillis(now)}`,
              })
              .pipe(Effect.ignore)
          }
          if (isDone(after.status)) yield* handled(id, me.id)
          yield* settle([id])
          return yield* toRow(principal, after)
        }),

        markRead: Effect.fn("Desk.markRead")(function* (principal: Principal, id: RequestId) {
          yield* visible(principal, id)
          yield* requests.markRead(personOf(principal).id, id, yield* DateTime.now)
        }),
      })
    }),
  )
}
