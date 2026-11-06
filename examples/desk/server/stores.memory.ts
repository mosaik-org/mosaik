import { Conflict, NotFound } from "@mosaik/sdk"
import { DateTime, Effect, Layer } from "effect"
import {
  DeadlineRule,
  DeskRequest,
  nextDue,
  type Person,
  type Priority,
  Queue,
  QueueId,
  type RequestId,
  RequestId as RequestIdSchema,
  SavedReply,
  SavedReplyId,
  YOUR_MOVE_STATUSES,
} from "../api"
import { makePeople, People, type PeopleStore } from "./People"
import { type RequestFilter, Requests, type StoredActivity } from "./Requests"
import { Setup } from "./Setup"

/**
 * The desk's stores kept in memory, for its tests: the same services without Postgres, so tests of the
 * API run anywhere and at once. They keep how data is found and kept; what it means (permissions,
 * deadlines, who hears of what) stays in `Desk` and `api/rules`, which the tests exercise for real.
 */

const matches = (request: DeskRequest, filter: RequestFilter) =>
  (filter.inboxOf === undefined || request.assigneeId === filter.inboxOf || request.assigneeId === null) &&
  (filter.requesterId === undefined || request.requesterId === filter.requesterId) &&
  (filter.statuses === undefined || filter.statuses.includes(request.status)) &&
  (filter.queueId === undefined || request.queueId === filter.queueId) &&
  (!filter.search ||
    `${request.id} ${request.title} ${request.body}`.toLowerCase().includes(filter.search.toLowerCase()))

const millisOf = (at: DateTime.Utc | undefined) =>
  at === undefined ? Number.POSITIVE_INFINITY : DateTime.toEpochMillis(at)

const countBy = <K>(keys: ReadonlyArray<K>): ReadonlyMap<K, number> => {
  const counts = new Map<K, number>()
  for (const key of keys) counts.set(key, (counts.get(key) ?? 0) + 1)
  return counts
}

export const InMemoryRequests = Layer.sync(Requests, () => {
  const requests = new Map<RequestId, DeskRequest>()
  const lines: Array<StoredActivity> = []
  const reads = new Map<string, DateTime.Utc>()
  const told = new Map<RequestId, number>()
  let lastRequest = 0
  let lastLine = 0

  const all = () => [...requests.values()]
  const missing = (id: RequestId) => new NotFound({ resource: "request", id: String(id) })
  const add = (requestId: RequestId, line: Omit<StoredActivity, "id" | "requestId">) => {
    lines.push({ ...line, id: ++lastLine, requestId })
  }
  const overdue = (now: DateTime.Utc) =>
    all().filter((request) => {
      const due = nextDue(request)
      return due !== undefined && DateTime.isLessThan(due.at, now)
    })

  return Requests.of({
    get: (id) => {
      const request = requests.get(id)
      return request === undefined ? Effect.fail(missing(id)) : Effect.succeed(request)
    },
    list: (filter, order, limit) =>
      Effect.sync(() =>
        all()
          .filter((request) => matches(request, filter))
          .toSorted((a, b) =>
            order === "urgency"
              ? millisOf(nextDue(a)?.at) - millisOf(nextDue(b)?.at) || b.id - a.id
              : millisOf(b.lastActivityAt) - millisOf(a.lastActivityAt) || b.id - a.id,
          )
          .slice(0, limit),
      ),
    count: (filter) => Effect.sync(() => all().filter((request) => matches(request, filter)).length),
    countByQueue: (filter) =>
      Effect.sync(() =>
        [
          ...countBy(
            all()
              .filter((request) => matches(request, filter))
              .map((request) => request.queueId),
          ),
        ].map(([queueId, count]) => ({ queueId, count })),
      ),
    insert: (request, activity) =>
      Effect.sync(() => {
        const created = new DeskRequest({ ...request, id: RequestIdSchema.make(++lastRequest) })
        requests.set(created.id, created)
        add(created.id, activity)
        return created
      }),
    edit: (id, change) =>
      Effect.gen(function* () {
        const request = requests.get(id)
        if (request === undefined) return yield* missing(id)
        const { request: next, activity } = yield* change(request)
        requests.set(id, new DeskRequest({ ...next }))
        for (const line of activity) add(id, line)
        return next
      }),
    remove: (id) => Effect.suspend(() => (requests.delete(id) ? Effect.void : Effect.fail(missing(id)))),
    activity: (id, { notes }) =>
      Effect.sync(() => lines.filter((line) => line.requestId === id && (notes || line.kind !== "note"))),
    readTimes: (personId, ids) =>
      Effect.sync(
        () =>
          new Map(
            ids.flatMap((id) => {
              const at = reads.get(`${personId}:${id}`)
              return at === undefined ? [] : [[id, at] as const]
            }),
          ),
      ),
    markRead: (personId, id, at) => Effect.sync(() => void reads.set(`${personId}:${id}`, at)),
    assignedTo: (personId) =>
      Effect.sync(() => all().filter((request) => request.assigneeId === personId && request.status !== "closed")),
    overdueToTell: (now) =>
      Effect.sync(() => overdue(now).filter((request) => told.get(request.id) !== millisOf(nextDue(request)?.at))),
    markOverdueTold: (id, due) => Effect.sync(() => void told.set(id, DateTime.toEpochMillis(due))),
    solvedBefore: (at) =>
      Effect.sync(() =>
        all().filter(
          (request) =>
            request.status === "solved" && request.solvedAt !== null && DateTime.isLessThan(request.solvedAt, at),
        ),
      ),
    yourMoveByAssignee: Effect.sync(() =>
      [
        ...countBy(
          all().flatMap((request) =>
            request.assigneeId !== null && YOUR_MOVE_STATUSES.includes(request.status) ? [request.assigneeId] : [],
          ),
        ),
      ].map(([personId, count]) => ({ personId, count })),
    ),
    waitingByRequester: Effect.sync(() =>
      [
        ...countBy(
          all()
            .filter((request) => request.status === "waiting")
            .map((request) => request.requesterId),
        ),
      ].map(([personId, count]) => ({ personId, count })),
    ),
    overdueCount: (now) => Effect.sync(() => overdue(now).length),
  })
})

export const InMemoryPeople = Layer.sync(People, () => {
  const people = new Map<string, { person: Person; agent: boolean; left: boolean }>()
  const store: PeopleStore = {
    save: (person, agent) => Effect.sync(() => void people.set(person.id, { person, agent, left: false })),
    setAgent: (id, agent) =>
      Effect.sync(() => {
        const known = people.get(id)
        if (known !== undefined) known.agent = agent
      }),
    markLeft: (id) =>
      Effect.sync(() => {
        const known = people.get(id)
        if (known !== undefined) {
          known.agent = false
          known.left = true
        }
      }),
    byIds: (ids) =>
      Effect.sync(
        () =>
          new Map(
            ids.flatMap((id) => {
              const known = people.get(id)
              return known === undefined ? [] : [[id, known.person] as const]
            }),
          ),
      ),
    agents: Effect.sync(() =>
      [...people.values()].filter((known) => known.agent && !known.left).map((known) => known.person),
    ),
    isAgent: (id) =>
      Effect.sync(() => {
        const known = people.get(id)
        return known?.agent === true && !known.left
      }),
  }
  return makePeople(store)
})

/** A desk set up with these queues, the rules of the first migration, and no saved replies. */
export const InMemorySetup = (queueNames: ReadonlyArray<string>) =>
  Layer.sync(Setup, () => {
    let lastQueue = 0
    let lastSavedReply = 0
    const queues = new Map<QueueId, Queue>()
    const saved = new Map<SavedReplyId, SavedReply>()
    const rule = (priority: Priority, respondMinutes: number, resolveMinutes: number) =>
      new DeadlineRule({ priority, respondMinutes, resolveMinutes })
    const deadlines = new Map<Priority, DeadlineRule>([
      ["urgent", rule("urgent", 30, 240)],
      ["high", rule("high", 120, 480)],
      ["normal", rule("normal", 480, 2880)],
      ["low", rule("low", 1440, 7200)],
    ])
    const add = (name: string, description: string) => {
      const queue = new Queue({ id: QueueId.make(++lastQueue), name, description })
      queues.set(queue.id, queue)
      return queue
    }
    for (const name of queueNames) add(name, "")
    const taken = (name: string, self?: QueueId) =>
      [...queues.values()].some((queue) => queue.name === name && queue.id !== self)
        ? Effect.fail(new Conflict({ message: `There is a queue called ${name} already` }))
        : Effect.void
    const noSuchQueue = (id: QueueId) => new NotFound({ resource: "queue", id: String(id) })
    const noSuchReply = (id: SavedReplyId) => new NotFound({ resource: "saved reply", id: String(id) })

    return Setup.of({
      queues: Effect.sync(() => [...queues.values()]),
      createQueue: (input) =>
        Effect.andThen(
          taken(input.name),
          Effect.sync(() => add(input.name, input.description)),
        ),
      updateQueue: (id, input) =>
        Effect.gen(function* () {
          if (!queues.has(id)) return yield* noSuchQueue(id)
          yield* taken(input.name, id)
          const queue = new Queue({ id, name: input.name, description: input.description })
          queues.set(id, queue)
          return queue
        }),
      removeQueue: (id) => Effect.suspend(() => (queues.delete(id) ? Effect.void : Effect.fail(noSuchQueue(id)))),
      deadlines: Effect.sync(() => [...deadlines.values()]),
      deadline: (priority) => Effect.sync(() => deadlines.get(priority) as DeadlineRule),
      setDeadline: (next) =>
        Effect.sync(() => {
          deadlines.set(next.priority, next)
          return next
        }),
      savedReplies: Effect.sync(() => [...saved.values()]),
      createSavedReply: (input) =>
        Effect.sync(() => {
          const reply = new SavedReply({ id: SavedReplyId.make(++lastSavedReply), ...input })
          saved.set(reply.id, reply)
          return reply
        }),
      updateSavedReply: (id, input) =>
        Effect.suspend(() => {
          if (!saved.has(id)) return Effect.fail(noSuchReply(id))
          const reply = new SavedReply({ id, ...input })
          saved.set(id, reply)
          return Effect.succeed(reply)
        }),
      removeSavedReply: (id) => Effect.suspend(() => (saved.delete(id) ? Effect.void : Effect.fail(noSuchReply(id)))),
    })
  })
