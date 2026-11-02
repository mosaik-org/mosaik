import { AccessControl, BadRequest, Conflict, NotFound } from "@mosaik/core"
import { Schema } from "effect"
import { HttpApi, HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/http-api"

/**
 * The assistant: a chat in Mosaik's UI with an AI that uses apps' tools (`AgentTool`) as the
 * person, asking them to approve every change. Served by Core's assistant service under
 * {@link ASSISTANT_API_PREFIX}, through the gateway.
 *
 * Conversations are stored in this contract's form, not any AI library's or provider's, so they
 * stay readable whichever model and library run the assistant.
 */
export const ASSISTANT_API_PREFIX = "/api/assistant"

/** Options the model's provider attached to a part, passed back to it unchanged (opaque here). */
const ProviderOptions = Schema.optionalKey(Schema.Json)

export const TextPart = Schema.Struct({ type: Schema.tag("text"), text: Schema.String })

/** The model's reasoning, when its provider returns it: kept for the model, not shown. */
export const ReasoningPart = Schema.Struct({
  type: Schema.tag("reasoning"),
  text: Schema.String,
  providerOptions: ProviderOptions,
})

/** A tool the model asked to call, with what people need to judge it. */
export const ToolCallPart = Schema.Struct({
  type: Schema.tag("tool-call"),
  id: Schema.String,
  /** The tool's name (`<app>_<group>_<endpoint>`). */
  tool: Schema.String,
  input: Schema.Json,
  /** Its title and app, as they were when it was called. */
  title: Schema.String,
  app: Schema.String,
  /** Changes something: runs only once the person approves. */
  changes: Schema.Boolean,
  /** Its permission is dangerous in the app's manifest. */
  destructive: Schema.Boolean,
  providerOptions: ProviderOptions,
})
export type ToolCallPart = typeof ToolCallPart.Type

/** What a call came to: the app's answer, or why it did not run. */
export const ToolResultPart = Schema.Struct({
  type: Schema.tag("tool-result"),
  id: Schema.String,
  tool: Schema.String,
  ok: Schema.Boolean,
  text: Schema.String,
  /** For calls that needed approval: what the person decided. */
  decision: Schema.optionalKey(Schema.Literals(["approved", "denied"])),
})
export type ToolResultPart = typeof ToolResultPart.Type

export const MessagePart = Schema.Union([TextPart, ReasoningPart, ToolCallPart, ToolResultPart])
export type MessagePart = typeof MessagePart.Type

/** Where the person was when they wrote, so "this order" can mean the one on screen. */
export const PageContext = Schema.Struct({
  /** The app they had open, if any. */
  app: Schema.NullOr(Schema.String),
  path: Schema.String,
  title: Schema.NullOr(Schema.String),
})
export type PageContext = typeof PageContext.Type

export class Message extends Schema.Class<Message>("@mosaik/assistant/Message")({
  id: Schema.Int,
  /** `tool`: results of the calls of the assistant message before it. */
  role: Schema.Literals(["user", "assistant", "tool"]),
  parts: Schema.Array(MessagePart),
  /** The person's page, on their messages. */
  context: Schema.NullOr(PageContext),
  createdAt: Schema.DateTimeUtc,
}) {}

export class ConversationSummary extends Schema.Class<ConversationSummary>("@mosaik/assistant/ConversationSummary")({
  id: Schema.String,
  title: Schema.String,
  createdAt: Schema.DateTimeUtc,
  updatedAt: Schema.DateTimeUtc,
}) {}

export class Conversation extends Schema.Class<Conversation>("@mosaik/assistant/Conversation")({
  ...ConversationSummary.fields,
  messages: Schema.Array(Message),
  /** Calls waiting for the person's decision; the conversation goes on once all are decided. */
  pending: Schema.Array(ToolCallPart),
}) {}

/**
 * What a turn streams: the reply as it is written, every message as it is stored, and how the
 * turn ends (done, waiting for approvals, or failed).
 */
export const TurnEvent = Schema.Union([
  /** More of the reply being written; replaced by the stored message when it is complete. */
  Schema.Struct({ type: Schema.tag("text"), text: Schema.String }),
  Schema.Struct({ type: Schema.tag("message"), message: Message }),
  /** The turn waits for the person to approve or deny these calls. */
  Schema.Struct({ type: Schema.tag("approval"), calls: Schema.Array(ToolCallPart) }),
  Schema.Struct({ type: Schema.tag("done") }),
  Schema.Struct({ type: Schema.tag("failed"), message: Schema.String }),
])
export type TurnEvent = typeof TurnEvent.Type

export class AssistantStatus extends Schema.Class<AssistantStatus>("@mosaik/assistant/AssistantStatus")({
  /** An admin set up a model; without one, the assistant is off. */
  enabled: Schema.Boolean,
  /** The model it uses, e.g. `opencode/deepseek-v4.1-flash`. */
  model: Schema.NullOr(Schema.String),
}) {}

export const SendMessage = Schema.Struct({
  text: Schema.String.check(Schema.isTrimmed(), Schema.isMinLength(1), Schema.isMaxLength(10_000)),
  /** Where the person is; `null` from the assistant's own page, which is about no other page. */
  context: Schema.NullOr(PageContext),
})

export const Decision = Schema.Struct({
  /** A pending call's id. */
  call: Schema.String,
  approve: Schema.Boolean,
})

/** A turn's events, as Server-Sent Events of {@link TurnEvent}. */
const TurnStream = Schema.String.pipe(HttpApiSchema.asText({ contentType: "text/event-stream" }))

const conversation = { id: Schema.String }

export class AssistantGroup extends HttpApiGroup.make("assistant").add(
  HttpApiEndpoint.get("status", "/status", { success: AssistantStatus }),
  /** The person's conversations, latest first. */
  HttpApiEndpoint.get("conversations", "/conversations", { success: Schema.Array(ConversationSummary) }),
  HttpApiEndpoint.post("start", "/conversations", { success: ConversationSummary }),
  HttpApiEndpoint.get("conversation", "/conversations/:id", {
    params: conversation,
    success: Conversation,
    error: NotFound,
  }),
  /**
   * Sends the person's message and streams the turn it starts. Calls still waiting for a
   * decision are denied: the person moved on.
   */
  HttpApiEndpoint.post("send", "/conversations/:id/messages", {
    params: conversation,
    payload: SendMessage,
    success: TurnStream,
    error: [NotFound, Conflict, BadRequest],
  }),
  /** Approves or denies waiting calls; once none is left, streams the rest of the turn. */
  HttpApiEndpoint.post("decide", "/conversations/:id/decisions", {
    params: conversation,
    payload: Schema.Struct({ decisions: Schema.Array(Decision).check(Schema.isMinLength(1)) }),
    success: TurnStream,
    error: [NotFound, Conflict, BadRequest],
  }),
) {}

/** The assistant's browser API; every endpoint needs a signed-in person. */
export class AssistantApi extends HttpApi.make("assistant")
  .add(AssistantGroup)
  .prefix(ASSISTANT_API_PREFIX)
  .middleware(AccessControl) {}
