import {
  AccessControl,
  AgentTool,
  BadRequest,
  Conflict,
  NotFound,
  RequiredPermission,
  StorageLimitReached,
  StorageUnavailable,
} from "@mosaik/sdk"
import { Schema } from "effect"
import { Multipart } from "effect/http"
import { HttpApi, HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/http-api"
import { desk } from "../manifest"
import {
  Activity,
  Attachment,
  DeadlineRule,
  EditResult,
  MAX_ATTACHMENT_BYTES,
  NewReply,
  NewRequest,
  Person,
  Queue,
  QueueId,
  QueueInput,
  RequestEdits,
  RequestId,
  RequestRow,
  RequestsPage,
  RequestsQuery,
  SavedReply,
  SavedReplyId,
  SavedReplyInput,
} from "./domain"

export * from "./domain"
export * from "./rules"

const params = { id: RequestId }

export class RequestsGroup extends HttpApiGroup.make("requests")
  .add(
    HttpApiEndpoint.get("list", "/", { query: RequestsQuery.fields, success: RequestsPage }).annotate(AgentTool, {
      title: "Find requests",
      examples: ["What is waiting for me on the service desk?", "Which requests are overdue?"],
      description:
        "Service desk requests, most urgent first. `view` is `inbox` (assigned to me, or to nobody), `all` " +
        "(everyone's), `mine` (those I sent) or `visible` (all I may see). `state` is `active` or `done`; " +
        "`search` matches the words or the number.",
    }),
    HttpApiEndpoint.get("get", "/:id", { params, success: RequestRow, error: NotFound }).annotate(AgentTool, {
      title: "Read a request",
      description: "One service desk request, with who asked, who has it and its deadlines.",
    }),
    HttpApiEndpoint.post("create", "/", { payload: NewRequest, success: RequestRow, error: BadRequest }).annotate(
      AgentTool,
      {
        title: "Send a request",
        examples: ["Ask IT for a new laptop"],
        description: "Sends a request to a queue (see `Queues`). The person it is sent for is the one asking.",
      },
    ),
    /**
     * Changes requests. People who work on requests may change anything; the person who asked may change
     * its words and say it is solved. Answers with what undoes it.
     */
    HttpApiEndpoint.patch("edit", "/", {
      payload: RequestEdits,
      success: EditResult,
      error: [NotFound, BadRequest, Conflict],
    }),
    /** For people who may delete requests, and the person who asked while nobody has picked it up. */
    HttpApiEndpoint.delete("remove", "/:id", {
      params,
      success: HttpApiSchema.NoContent,
      error: [NotFound, Conflict],
    }),
    HttpApiEndpoint.get("activity", "/:id/activity", {
      params,
      success: Schema.Array(Activity),
      error: NotFound,
    }).annotate(AgentTool, {
      title: "Read a request's story",
      description: "What was said and what changed on a request. Internal notes show only to people who work on them.",
    }),
    HttpApiEndpoint.post("reply", "/:id/replies", {
      params,
      payload: NewReply,
      success: RequestRow,
      error: [NotFound, Conflict],
    }).annotate(AgentTool, {
      title: "Reply to a request",
      description:
        "Adds to a request. `kind` is `reply`, which the person who asked reads, or `note`, for people who work on it.",
    }),
    /** The viewer has seen the latest: it stops standing out in their lists. */
    HttpApiEndpoint.post("markRead", "/:id/read", {
      params,
      success: HttpApiSchema.NoContent,
      error: NotFound,
    }),
    /** Asks for what changed as it happens: `RequestsChanged`, as Server-Sent Events. */
    HttpApiEndpoint.get("live", "/live", {
      success: Schema.String.pipe(HttpApiSchema.asText({ contentType: "text/event-stream" })),
    }),
    HttpApiEndpoint.get("attachments", "/:id/attachments", {
      params,
      success: Schema.Array(Attachment),
      error: [NotFound, StorageUnavailable],
    }),
    /** A PDF, an image or a text file (`ATTACHMENT_TYPES`), sent as `multipart/form-data`. */
    HttpApiEndpoint.post("attach", "/:id/attachments", {
      params,
      payload: Schema.Struct({ file: Multipart.SingleFileSchema }).pipe(
        HttpApiSchema.asMultipart({ maxFileSize: MAX_ATTACHMENT_BYTES }),
      ),
      success: Attachment,
      error: [NotFound, BadRequest, StorageLimitReached, StorageUnavailable],
    }),
    /** The file itself: a download, or shown in the browser with `?inline=true`. */
    HttpApiEndpoint.get("attachment", "/:id/attachments/:name", {
      params: { id: RequestId, name: Schema.String },
      query: { inline: Schema.optional(Schema.Literals(["true", "false"])) },
      success: Schema.Uint8Array.pipe(HttpApiSchema.asUint8Array()),
      error: [NotFound, StorageUnavailable],
    }),
    HttpApiEndpoint.delete("detach", "/:id/attachments/:name", {
      params: { id: RequestId, name: Schema.String },
      success: HttpApiSchema.NoContent,
      error: [NotFound, StorageUnavailable],
    }).annotate(RequiredPermission, desk.perm("requests.work")),
  )
  .prefix("/requests") {}

/** What everyone needs to ask: where requests can go. */
export class DirectoryGroup extends HttpApiGroup.make("directory")
  .add(
    HttpApiEndpoint.get("queues", "/queues", { success: Schema.Array(Queue) }).annotate(AgentTool, {
      title: "Queues",
      description: "Where service desk requests can go: the teams that handle them.",
    }),
    /** Who requests can be given to. */
    HttpApiEndpoint.get("agents", "/agents", { success: Schema.Array(Person) }).annotate(
      RequiredPermission,
      desk.perm("requests.work"),
    ),
    /** How fast each priority is due: the pages show what a change of priority does at once. */
    HttpApiEndpoint.get("deadlines", "/deadlines", { success: Schema.Array(DeadlineRule) }).annotate(
      RequiredPermission,
      desk.perm("requests.work"),
    ),
    /** Texts to answer with. */
    HttpApiEndpoint.get("savedReplies", "/saved-replies", { success: Schema.Array(SavedReply) }).annotate(
      RequiredPermission,
      desk.perm("requests.work"),
    ),
  )
  .prefix("/directory") {}

const configure = desk.perm("configure")
const queueParams = { id: QueueId }
const savedReplyParams = { id: SavedReplyId }

export class SetupGroup extends HttpApiGroup.make("setup")
  .add(
    HttpApiEndpoint.post("createQueue", "/queues", { payload: QueueInput, success: Queue, error: Conflict }).annotate(
      RequiredPermission,
      configure,
    ),
    HttpApiEndpoint.put("updateQueue", "/queues/:id", {
      params: queueParams,
      payload: QueueInput,
      success: Queue,
      error: [NotFound, Conflict],
    }).annotate(RequiredPermission, configure),
    /** Refused while requests are in it: people move them first. */
    HttpApiEndpoint.delete("removeQueue", "/queues/:id", {
      params: queueParams,
      success: HttpApiSchema.NoContent,
      error: [NotFound, Conflict],
    }).annotate(RequiredPermission, configure),
    /** Applies to requests from now on: what was promised to the others stays. */
    HttpApiEndpoint.put("setDeadline", "/deadlines", {
      payload: DeadlineRule,
      success: DeadlineRule,
      error: BadRequest,
    }).annotate(RequiredPermission, configure),
    HttpApiEndpoint.post("createSavedReply", "/saved-replies", {
      payload: SavedReplyInput,
      success: SavedReply,
    }).annotate(RequiredPermission, configure),
    HttpApiEndpoint.put("updateSavedReply", "/saved-replies/:id", {
      params: savedReplyParams,
      payload: SavedReplyInput,
      success: SavedReply,
      error: NotFound,
    }).annotate(RequiredPermission, configure),
    HttpApiEndpoint.delete("removeSavedReply", "/saved-replies/:id", {
      params: savedReplyParams,
      success: HttpApiSchema.NoContent,
      error: NotFound,
    }).annotate(RequiredPermission, configure),
  )
  .prefix("/setup") {}

export class DeskApi extends HttpApi.make("desk")
  .add(RequestsGroup, DirectoryGroup, SetupGroup)
  .prefix(desk.apiPrefix)
  .middleware(AccessControl) {}
