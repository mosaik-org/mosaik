import { Schema } from "effect"

export const RequestId = Schema.Int.pipe(Schema.brand("@mosaik/desk/RequestId"))
export type RequestId = typeof RequestId.Type

export const QueueId = Schema.Int.pipe(Schema.brand("@mosaik/desk/QueueId"))
export type QueueId = typeof QueueId.Type

export const SavedReplyId = Schema.Int.pipe(Schema.brand("@mosaik/desk/SavedReplyId"))
export type SavedReplyId = typeof SavedReplyId.Type

/**
 * Where a request stands. `new`: nobody has picked it up. `open`: someone is on it. `waiting`: the
 * ball is with the person who asked. `solved`: done, though a reply reopens it. `closed`: done for
 * good, by the desk itself some days later.
 */
export const RequestStatus = Schema.Literals(["new", "open", "waiting", "solved", "closed"])
export type RequestStatus = typeof RequestStatus.Type

export const Priority = Schema.Literals(["urgent", "high", "normal", "low"])
export type Priority = typeof Priority.Type

/** Someone the desk knows: the people who ask, and the people who answer. */
export class Person extends Schema.Class<Person>("@mosaik/desk/Person")({
  id: Schema.String,
  name: Schema.String,
  email: Schema.String,
  image: Schema.NullOr(Schema.String),
}) {}

/** A request as it is kept. Deadlines are stored, so lists can be sorted by what is due first. */
export class DeskRequest extends Schema.Class<DeskRequest>("@mosaik/desk/DeskRequest")({
  id: RequestId,
  title: Schema.String,
  body: Schema.String,
  queueId: QueueId,
  priority: Priority,
  status: RequestStatus,
  requesterId: Schema.String,
  assigneeId: Schema.NullOr(Schema.String),
  createdAt: Schema.DateTimeUtc,
  updatedAt: Schema.DateTimeUtc,
  /** When someone must have answered by. */
  respondBy: Schema.DateTimeUtc,
  /** When it must be solved by. */
  resolveBy: Schema.DateTimeUtc,
  firstRepliedAt: Schema.NullOr(Schema.DateTimeUtc),
  solvedAt: Schema.NullOr(Schema.DateTimeUtc),
  /** Since when the clock has stopped: while the ball is with the person who asked, or it is solved. */
  pausedAt: Schema.NullOr(Schema.DateTimeUtc),
  /** How long the clock has stood still so far; it moves the deadlines. */
  pausedSeconds: Schema.Int,
  lastActivityAt: Schema.DateTimeUtc,
  lastActivityBy: Schema.NullOr(Schema.String),
}) {}

/** A request for a list or a page: with who and where, and whether the viewer has seen the latest. */
export class RequestRow extends Schema.Class<RequestRow>("@mosaik/desk/RequestRow")({
  ...DeskRequest.fields,
  requester: Person,
  assignee: Schema.NullOr(Person),
  queueName: Schema.String,
  unread: Schema.Boolean,
}) {}

export const requestNumber = (id: number) => `REQ-${id}`

/** Which requests a page shows. `visible` is whatever the person may see, for search. */
export const RequestsView = Schema.Literals(["inbox", "all", "mine", "visible"])
export type RequestsView = typeof RequestsView.Type

/** Still being worked on, or done. */
export const RequestsState = Schema.Literals(["active", "done"])
export type RequestsState = typeof RequestsState.Type

const SearchText = Schema.String.check(Schema.isMaxLength(200))

/** What a list page keeps in its address. */
export const RequestsSearch = Schema.Struct({
  queue: Schema.optional(QueueId),
  state: Schema.optional(RequestsState),
  search: Schema.optional(SearchText),
  /** The request open beside the list. */
  open: Schema.optional(RequestId),
})
export type RequestsSearch = typeof RequestsSearch.Type

export const REQUESTS_PAGE = 50

/** Asking for a list. `queue`, `state` and `search` are what the page keeps in its address. */
export const RequestsQuery = Schema.Struct({
  view: RequestsView,
  queue: Schema.optional(QueueId),
  state: Schema.optional(RequestsState),
  search: Schema.optional(SearchText),
  limit: Schema.optional(Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 500 }))),
})
export type RequestsQuery = typeof RequestsQuery.Type

export class QueueCount extends Schema.Class<QueueCount>("@mosaik/desk/QueueCount")({
  queueId: QueueId,
  count: Schema.Int,
}) {}

export class RequestsPage extends Schema.Class<RequestsPage>("@mosaik/desk/RequestsPage")({
  rows: Schema.Array(RequestRow),
  /** How many match, in the queue asked for. */
  total: Schema.Int,
  /** How many match per queue, whichever queue was asked for: the tabs above the list. */
  byQueue: Schema.Array(QueueCount),
}) {}

const Title = Schema.String.check(
  Schema.isTrimmed({ message: "No spaces around it" }),
  Schema.isMinLength(1, { message: "Say what it is about" }),
  Schema.isMaxLength(200, { message: "Keep it under 200 characters" }),
)

const Body = Schema.String.check(
  Schema.isTrimmed({ message: "No spaces around it" }),
  Schema.isMinLength(1, { message: "Write something first" }),
  Schema.isMaxLength(20_000, { message: "Keep it under 20,000 characters" }),
)

export class NewRequest extends Schema.Class<NewRequest>("@mosaik/desk/NewRequest")({
  title: Title,
  body: Body,
  queueId: QueueId,
  priority: Priority,
}) {}

/** What can change on a request. What is left out stays as it is. */
export const RequestChange = Schema.Struct({
  title: Schema.optional(Title),
  body: Schema.optional(Body),
  queueId: Schema.optional(QueueId),
  priority: Schema.optional(Priority),
  status: Schema.optional(RequestStatus),
  assigneeId: Schema.optional(Schema.NullOr(Schema.String)),
})
export type RequestChange = typeof RequestChange.Type

export const RequestEdit = Schema.Struct({ id: RequestId, change: RequestChange })
export type RequestEdit = typeof RequestEdit.Type

/** One change or many: each request says its own, so undoing many is the same call. */
export const RequestEdits = Schema.Struct({
  edits: Schema.Array(RequestEdit).check(Schema.isMinLength(1), Schema.isMaxLength(200)),
})
export type RequestEdits = typeof RequestEdits.Type

export class EditResult extends Schema.Class<EditResult>("@mosaik/desk/EditResult")({
  rows: Schema.Array(RequestRow),
  /** What puts them back as they were. */
  undo: Schema.Array(RequestEdit),
}) {}

export const ReplyKind = Schema.Literals(["reply", "note"])
export type ReplyKind = typeof ReplyKind.Type

export class NewReply extends Schema.Class<NewReply>("@mosaik/desk/NewReply")({
  body: Body,
  /** `reply` reaches the person who asked. `note` stays between the people working on it. */
  kind: ReplyKind,
  /** Solves it with this reply. */
  solve: Schema.optional(Schema.Boolean),
}) {}

export const ChangedField = Schema.Literals(["title", "body", "queue", "priority", "status", "assignee"])
export type ChangedField = typeof ChangedField.Type

/** A line in a request's story. */
export const ActivityKind = Schema.Literals(["created", "reply", "note", "change"])
export type ActivityKind = typeof ActivityKind.Type

export class Activity extends Schema.Class<Activity>("@mosaik/desk/Activity")({
  id: Schema.Int,
  requestId: RequestId,
  kind: ActivityKind,
  author: Schema.NullOr(Person),
  /** What was said, for a reply or a note. */
  body: Schema.NullOr(Schema.String),
  /** What changed, for a change: in words, as it read then. */
  field: Schema.NullOr(ChangedField),
  from: Schema.NullOr(Schema.String),
  to: Schema.NullOr(Schema.String),
  createdAt: Schema.DateTimeUtc,
}) {}

export class Attachment extends Schema.Class<Attachment>("@mosaik/desk/Attachment")({
  name: Schema.String,
  size: Schema.Number,
  contentType: Schema.String,
  uploadedAt: Schema.DateTimeUtc,
}) {}

export const ATTACHMENT_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/webp", "text/plain"] as const
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024

const Name = Schema.String.check(
  Schema.isTrimmed({ message: "No spaces around it" }),
  Schema.isMinLength(1, { message: "Give it a name" }),
  Schema.isMaxLength(80, { message: "Keep it under 80 characters" }),
)

/** Where requests go: a team that handles a kind of them. */
export class Queue extends Schema.Class<Queue>("@mosaik/desk/Queue")({
  id: QueueId,
  name: Schema.String,
  description: Schema.String,
}) {}

export class QueueInput extends Schema.Class<QueueInput>("@mosaik/desk/QueueInput")({
  name: Name,
  description: Schema.String.check(Schema.isMaxLength(200, { message: "Keep it under 200 characters" })),
}) {}

/** How fast a priority must be answered and solved, in minutes of the clock running. */
export class DeadlineRule extends Schema.Class<DeadlineRule>("@mosaik/desk/DeadlineRule")({
  priority: Priority,
  respondMinutes: Schema.Int.check(Schema.isGreaterThan(0, { message: "More than nothing" })),
  resolveMinutes: Schema.Int.check(Schema.isGreaterThan(0, { message: "More than nothing" })),
}) {}

/** A text agents use again and again. */
export class SavedReply extends Schema.Class<SavedReply>("@mosaik/desk/SavedReply")({
  id: SavedReplyId,
  title: Schema.String,
  body: Schema.String,
}) {}

export class SavedReplyInput extends Schema.Class<SavedReplyInput>("@mosaik/desk/SavedReplyInput")({
  title: Name,
  body: Body,
}) {}

/** Told to open pages when requests change, so they refetch: which, never what, as anyone may listen. */
export class RequestsChanged extends Schema.Class<RequestsChanged>("@mosaik/desk/RequestsChanged")({
  ids: Schema.Array(RequestId),
}) {}
