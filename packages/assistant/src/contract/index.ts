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
  /** One of the {@link BrowserTools}: the person's browser runs it, not an app. */
  runsIn: Schema.optionalKey(Schema.Literal("browser")),
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
  /** Changes it waits for the person to allow (as of its last turn). */
  waitingChanges: Schema.Int,
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
 * turn ends (done, waiting for calls to be resolved, or failed).
 */
export const TurnEvent = Schema.Union([
  /** More of the reply being written; replaced by the stored message when it is complete. */
  Schema.Struct({ type: Schema.tag("text"), text: Schema.String }),
  Schema.Struct({ type: Schema.tag("message"), message: Message }),
  /**
   * The turn waits for these calls to be resolved: changes, by the person allowing or denying
   * them; browser tools, by the browser running them.
   */
  Schema.Struct({ type: Schema.tag("waiting"), calls: Schema.Array(ToolCallPart) }),
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

/** Where a page or record is, as the browser found it (`find_pages`). */
export const Place = Schema.Struct({
  title: Schema.String,
  subtitle: Schema.optionalKey(Schema.String),
  /** What kind of place: "Pages", or a kind of record such as "Orders". */
  group: Schema.String,
  /** A path in Mosaik, e.g. `/sales/orders?search=SO-1`. */
  path: Schema.String,
})
export type Place = typeof Place.Type

/**
 * Tools the person's browser runs (the frame showing the assistant), to find places in Mosaik
 * and take the person there. The model gets them beside apps' tools.
 */
export const BrowserTools = {
  find_pages: {
    title: "Find pages",
    description:
      "Finds pages and records in Mosaik the person can open (as its search, Ctrl+K, does), with their paths. " +
      "Use it to link to them, as Markdown links with the path, e.g. [SO-10938](/sales/orders?search=SO-10938). " +
      "Never make up paths: link only to what it returns.",
    input: Schema.Struct({
      query: Schema.String.check(Schema.isMinLength(2), Schema.isMaxLength(100)).annotate({
        description: "What to look for: a page's name, an order number, a customer…",
      }),
    }),
  },
  open_page: {
    title: "Open a page",
    description:
      "Takes the person to a page of Mosaik, with this conversation beside it. Only when they ask to go " +
      "somewhere; otherwise link to it. The path must come from find_pages.",
    input: Schema.Struct({
      path: Schema.String.check(Schema.isStartingWith("/")).annotate({ description: "A path from find_pages" }),
      title: Schema.optional(Schema.String).annotate({ description: "The page's title, as shown to the person" }),
    }),
  },
} as const
export type BrowserToolName = keyof typeof BrowserTools

export const isBrowserTool = (name: string): name is BrowserToolName => Object.hasOwn(BrowserTools, name)

/** How a waiting call is resolved. */
export const Resolution = Schema.Union([
  /** By the person: a change they allow or deny. */
  Schema.Struct({ type: Schema.tag("decision"), call: Schema.String, approve: Schema.Boolean }),
  /** By the browser: what a browser tool came to. */
  Schema.Struct({ type: Schema.tag("result"), call: Schema.String, ok: Schema.Boolean, text: Schema.String }),
])
export type Resolution = typeof Resolution.Type

/** A turn's events, as Server-Sent Events of {@link TurnEvent}. */
const TurnStream = Schema.String.pipe(HttpApiSchema.asText({ contentType: "text/event-stream" }))

const conversation = { id: Schema.String }

/** A conversation's title, as people give it. */
export const ConversationTitle = Schema.String.check(Schema.isTrimmed(), Schema.isMinLength(1), Schema.isMaxLength(120))

export class AssistantGroup extends HttpApiGroup.make("assistant").add(
  HttpApiEndpoint.get("status", "/status", { success: AssistantStatus }),
  /** The person's conversations, latest first. */
  HttpApiEndpoint.get("conversations", "/conversations", { success: Schema.Array(ConversationSummary) }),
  HttpApiEndpoint.post("start", "/conversations", { success: ConversationSummary }),
  /** Questions to suggest to the person: examples from the apps' tools they can use. */
  HttpApiEndpoint.get("suggestions", "/suggestions", { success: Schema.Array(Schema.String) }),
  HttpApiEndpoint.get("conversation", "/conversations/:id", {
    params: conversation,
    success: Conversation,
    error: NotFound,
  }),
  HttpApiEndpoint.patch("rename", "/conversations/:id", {
    params: conversation,
    payload: Schema.Struct({ title: ConversationTitle }),
    success: ConversationSummary,
    error: NotFound,
  }),
  /** Deletes the conversation and its messages, for good. */
  HttpApiEndpoint.delete("remove", "/conversations/:id", {
    params: conversation,
    success: HttpApiSchema.NoContent,
    error: [NotFound, Conflict],
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
  /** Resolves waiting calls; once none is left, streams the rest of the turn. */
  HttpApiEndpoint.post("resolve", "/conversations/:id/calls", {
    params: conversation,
    payload: Schema.Struct({ resolutions: Schema.Array(Resolution).check(Schema.isMinLength(1)) }),
    success: TurnStream,
    error: [NotFound, Conflict, BadRequest],
  }),
) {}

/** The assistant's browser API; every endpoint needs a signed-in person. */
export class AssistantApi extends HttpApi.make("assistant")
  .add(AssistantGroup)
  .prefix(ASSISTANT_API_PREFIX)
  .middleware(AccessControl) {}
