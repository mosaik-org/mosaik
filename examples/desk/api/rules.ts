import { DateTime, Duration } from "effect"
import type { ChangedField, DeadlineRule, DeskRequest, Priority, RequestChange, RequestStatus } from "./domain"

/**
 * The desk's rules, as plain functions of a request. Both sides run them: the backend to decide, and
 * the pages to show a change at once, before the backend has answered.
 */

/** The fields the rules read and write. */
export type RequestState = Pick<
  DeskRequest,
  | "title"
  | "body"
  | "queueId"
  | "priority"
  | "status"
  | "assigneeId"
  | "createdAt"
  | "updatedAt"
  | "respondBy"
  | "resolveBy"
  | "firstRepliedAt"
  | "solvedAt"
  | "pausedAt"
  | "pausedSeconds"
  | "lastActivityAt"
  | "lastActivityBy"
>

export const ACTIVE_STATUSES: ReadonlyArray<RequestStatus> = ["new", "open", "waiting"]
export const DONE_STATUSES: ReadonlyArray<RequestStatus> = ["solved", "closed"]
/** What agents act on. `waiting` is with the person who asked. */
export const YOUR_MOVE_STATUSES: ReadonlyArray<RequestStatus> = ["new", "open"]

/** The clock stands still while nobody on the desk can do anything about it. */
const isPaused = (status: RequestStatus) => status === "waiting" || status === "solved" || status === "closed"

const addSeconds = (at: DateTime.Utc, seconds: number) => DateTime.add(at, { seconds })

/** When a request is due: from when it came, by its priority's rule, plus however long the clock stopped. */
export const deadlinesFor = (
  createdAt: DateTime.Utc,
  rule: Pick<DeadlineRule, "respondMinutes" | "resolveMinutes">,
  pausedSeconds: number,
) => ({
  respondBy: addSeconds(createdAt, rule.respondMinutes * 60 + pausedSeconds),
  resolveBy: addSeconds(createdAt, rule.resolveMinutes * 60 + pausedSeconds),
})

const secondsBetween = (from: DateTime.Utc, to: DateTime.Utc) =>
  Math.max(0, Math.round(Duration.toSeconds(DateTime.distance(from, to))))

/** The state with its status changed, and the clock stopped or started to match. */
const withStatus = <R extends RequestState>(request: R, status: RequestStatus, now: DateTime.Utc): R => {
  if (status === request.status) return request
  const wasPaused = isPaused(request.status)
  const pauses = isPaused(status)
  const stoodStill = wasPaused && !pauses && request.pausedAt !== null ? secondsBetween(request.pausedAt, now) : 0
  return {
    ...request,
    status,
    pausedAt: pauses ? (wasPaused ? request.pausedAt : now) : null,
    pausedSeconds: request.pausedSeconds + stoodStill,
    respondBy: addSeconds(request.respondBy, stoodStill),
    resolveBy: addSeconds(request.resolveBy, stoodStill),
    solvedAt: status === "solved" || status === "closed" ? (request.solvedAt ?? now) : null,
  }
}

/** Why a change cannot be made; `undefined` when it can. */
export const changeProblem = (request: Pick<RequestState, "status">, change: RequestChange): string | undefined => {
  if (request.status === "closed") return "This request is closed. Send a new one instead."
  if (change.status === "closed") return "Solve it instead: the desk closes solved requests by itself."
  return undefined
}

/**
 * The request after a change. Picking up a new request also moves it on, and giving it away from
 * someone keeps it where it is. `rule` is the rule of the priority it ends up with.
 */
export const applyChange = <R extends RequestState>(
  request: R,
  change: RequestChange,
  rule: Pick<DeadlineRule, "respondMinutes" | "resolveMinutes">,
  actorId: string | null,
  now: DateTime.Utc,
): R => {
  const assigned =
    change.assigneeId !== undefined && change.assigneeId !== null && change.assigneeId !== request.assigneeId
  const status = change.status ?? (assigned && request.status === "new" ? "open" : request.status)
  const moved = withStatus(request, status, now)
  const priority = change.priority ?? request.priority
  return {
    ...moved,
    title: change.title ?? request.title,
    body: change.body ?? request.body,
    queueId: change.queueId ?? request.queueId,
    priority,
    assigneeId: change.assigneeId === undefined ? request.assigneeId : change.assigneeId,
    // A promise made stays made: the deadlines only move when its priority does.
    ...(priority === request.priority ? {} : deadlinesFor(request.createdAt, rule, moved.pausedSeconds)),
    updatedAt: now,
    lastActivityAt: now,
    lastActivityBy: actorId,
  }
}

/** What puts a request back as it was before a change: only the fields that moved. */
export const inverseChange = (before: RequestState, after: RequestState): RequestChange => ({
  ...(before.title === after.title ? {} : { title: before.title }),
  ...(before.body === after.body ? {} : { body: before.body }),
  ...(before.queueId === after.queueId ? {} : { queueId: before.queueId }),
  ...(before.priority === after.priority ? {} : { priority: before.priority }),
  ...(before.status === after.status ? {} : { status: before.status }),
  ...(before.assigneeId === after.assigneeId ? {} : { assigneeId: before.assigneeId }),
})

/** Which fields a change moved, for its lines in the request's story. */
export const changedFields = (before: RequestState, after: RequestState): ReadonlyArray<ChangedField> => [
  ...(before.title === after.title ? [] : (["title"] as const)),
  ...(before.body === after.body ? [] : (["body"] as const)),
  ...(before.queueId === after.queueId ? [] : (["queue"] as const)),
  ...(before.priority === after.priority ? [] : (["priority"] as const)),
  ...(before.status === after.status ? [] : (["status"] as const)),
  ...(before.assigneeId === after.assigneeId ? [] : (["assignee"] as const)),
]

export type ReplyBy = "agent" | "requester"

/**
 * The request after someone replies. An agent's answer stops the deadline for a first answer, puts
 * the ball with the person who asked, and goes to whoever answers first if nobody has it. The answer
 * of the person who asked puts the ball back, reopening a solved request.
 */
export const applyReply = <R extends RequestState>(
  request: R,
  reply: { readonly by: ReplyBy; readonly actorId: string; readonly solve?: boolean | undefined },
  now: DateTime.Utc,
): R => {
  const status: RequestStatus = reply.solve === true ? "solved" : reply.by === "agent" ? "waiting" : "open"
  return {
    ...withStatus(request, status, now),
    firstRepliedAt: reply.by === "agent" ? (request.firstRepliedAt ?? now) : request.firstRepliedAt,
    assigneeId: reply.by === "agent" ? (request.assigneeId ?? reply.actorId) : request.assigneeId,
    updatedAt: now,
    lastActivityAt: now,
    lastActivityBy: reply.actorId,
  }
}

/** A note changes nothing about where a request stands, only that something happened. */
export const applyNote = <R extends RequestState>(request: R, actorId: string, now: DateTime.Utc): R => ({
  ...request,
  updatedAt: now,
  lastActivityAt: now,
  lastActivityBy: actorId,
})

/** What the person who asked may change themselves: its words, and saying it is solved. */
export const requesterMay = (change: RequestChange): boolean =>
  change.queueId === undefined &&
  change.priority === undefined &&
  change.assigneeId === undefined &&
  (change.status === undefined || change.status === "solved")

/** The person who asked may take a request back while nobody has picked it up. */
export const requesterMayDelete = (request: Pick<RequestState, "status">): boolean => request.status === "new"

export type DeadlineKind = "reply" | "solve"
/** `soon`: under a quarter of the time is left. */
export type DeadlineState = "ok" | "soon" | "missed"

/** The deadline that counts now: a first answer until there is one, then solving it. */
export const nextDue = (
  request: Pick<RequestState, "status" | "firstRepliedAt" | "respondBy" | "resolveBy">,
): { readonly kind: DeadlineKind; readonly at: DateTime.Utc } | undefined => {
  if (isPaused(request.status)) return undefined
  return request.firstRepliedAt === null
    ? { kind: "reply", at: request.respondBy }
    : { kind: "solve", at: request.resolveBy }
}

export interface Deadline {
  readonly kind: DeadlineKind
  readonly at: DateTime.Utc
  readonly state: DeadlineState
  /** How long is left, negative once it has passed. */
  readonly millisLeft: number
}

export const deadlineOf = (
  request: Pick<RequestState, "status" | "firstRepliedAt" | "respondBy" | "resolveBy" | "createdAt">,
  now: DateTime.Utc,
): Deadline | undefined => {
  const due = nextDue(request)
  if (due === undefined) return undefined
  const millisLeft = DateTime.toEpochMillis(due.at) - DateTime.toEpochMillis(now)
  const span = DateTime.toEpochMillis(due.at) - DateTime.toEpochMillis(request.createdAt)
  const state: DeadlineState = millisLeft < 0 ? "missed" : millisLeft < span / 4 ? "soon" : "ok"
  return { ...due, state, millisLeft }
}

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** A time left in the fewest words: "12m", "3h", "2d". */
export const shortDuration = (millis: number): string => {
  const left = Math.abs(millis)
  if (left < HOUR) return `${Math.max(1, Math.round(left / MINUTE))}m`
  if (left < DAY) return `${Math.round(left / HOUR)}h`
  return `${Math.round(left / DAY)}d`
}

/** Every priority, most pressing first. */
export const PRIORITIES: ReadonlyArray<Priority> = ["urgent", "high", "normal", "low"]

export const PRIORITY_LABELS: Readonly<Record<Priority, string>> = {
  urgent: "Urgent",
  high: "High",
  normal: "Normal",
  low: "Low",
}

/** Statuses as people say them, for the people working on requests. */
export const STATUS_LABELS: Readonly<Record<RequestStatus, string>> = {
  new: "New",
  open: "In progress",
  waiting: "Waiting for reply",
  solved: "Solved",
  closed: "Closed",
}

/** Statuses as the person who asked reads them: what it means for them. */
export const REQUESTER_STATUS_LABELS: Readonly<Record<RequestStatus, string>> = {
  new: "Received",
  open: "Being worked on",
  waiting: "Waiting for you",
  solved: "Solved",
  closed: "Closed",
}

/** What agents can set: a request closes by itself. */
export const SETTABLE_STATUSES: ReadonlyArray<RequestStatus> = ["new", "open", "waiting", "solved"]
