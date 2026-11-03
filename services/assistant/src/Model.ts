import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock"
import { createAnthropic } from "@ai-sdk/anthropic"
import { createOpenAICompatible } from "@ai-sdk/openai-compatible"
import type { MessagePart, ToolCallPart } from "@mosaik/assistant/contract"
import type { InputSchema } from "@mosaik/tools"
import { generateText, jsonSchema, type LanguageModel, type ModelMessage, streamText, tool } from "ai"
import { Context, Data, Effect, Layer, Option, Redacted, Stream } from "effect"
import { AssistantConfig, type ModelSettings } from "./AssistantConfig"

/**
 * The model, behind one narrow interface: a single step of a conversation (the model's reply,
 * streamed, with the tools it asks to call). The turn's loop, tools, approvals and storage are
 * the service's own; only this module knows the AI library (the AI SDK), so replacing it means
 * rewriting this file.
 */

/** A message as the model is given it: the stored parts, with the person's page already in their text. */
export interface PromptMessage {
  readonly role: "user" | "assistant" | "tool"
  readonly parts: ReadonlyArray<MessagePart>
}

/** A tool the model may ask to call; the service runs it (the model never does). */
export interface ModelTool {
  readonly name: string
  readonly description: string
  readonly input: InputSchema
}

/** The parts of a reply, for its stored message: text, reasoning and tool calls (without what people judge them by). */
export type ReplyPart =
  | Extract<MessagePart, { readonly type: "text" | "reasoning" }>
  | Omit<ToolCallPart, "title" | "app" | "changes" | "destructive">

export type StepEvent =
  | { readonly type: "text"; readonly text: string }
  /** The reply is complete. */
  | { readonly type: "reply"; readonly parts: ReadonlyArray<ReplyPart> }

export class ModelError extends Data.TaggedError("ModelError")<{
  readonly message: string
  readonly cause?: unknown
}> {}

export class Model extends Context.Service<
  Model,
  {
    /** `<provider>/<model>`, as admins configured it. */
    readonly label: string
    readonly step: (options: {
      readonly system: string
      readonly messages: ReadonlyArray<PromptMessage>
      readonly tools: ReadonlyArray<ModelTool>
      /** The conversation, for providers that route or cache by it. */
      readonly session: string
    }) => Stream.Stream<StepEvent, ModelError>
    /** A short answer without tools, for the assistant's own needs (a conversation's title). */
    readonly complete: (options: {
      readonly system: string
      readonly prompt: string
      /** The conversation it is for, as for `step`. */
      readonly session: string
    }) => Effect.Effect<string, ModelError>
  }
>()("@mosaik/assistant-service/Model") {
  /** `None` when no model is configured: the assistant is off. */
  static readonly layer = Layer.effect(
    Model,
    Effect.gen(function* () {
      const config = yield* AssistantConfig
      return Option.match(config.model, {
        onNone: () =>
          Model.of({
            label: "",
            step: () => Stream.fail(new ModelError({ message: "The assistant is off" })),
            complete: () => Effect.fail(new ModelError({ message: "The assistant is off" })),
          }),
        onSome: (settings) =>
          Model.of({
            label: `${settings.provider}/${settings.model}`,
            step: stepWith(languageModel(settings), sessionHeaders(settings)),
            complete: completeWith(languageModel(settings), sessionHeaders(settings)),
          }),
      })
    }),
  )
}

/** How Mosaik identifies itself to providers that ask clients to (OpenCode Go). */
const USER_AGENT = "mosaik-assistant/1.0"

const languageModel = (settings: ModelSettings): LanguageModel => {
  switch (settings.provider) {
    case "opencode":
    case "opencode-go":
      return createOpenAICompatible({
        name: settings.provider,
        baseURL: settings.baseUrl,
        apiKey: Redacted.value(settings.apiKey),
        headers: { "user-agent": USER_AGENT },
      })(settings.model)
    case "anthropic":
      return createAnthropic({ apiKey: Redacted.value(settings.apiKey) })(settings.model)
    case "bedrock":
      return createAmazonBedrock({ region: settings.region })(settings.model)
  }
}

type AssistantMessage = Extract<ModelMessage, { role: "assistant" }>
type AssistantContentPart = Exclude<AssistantMessage["content"], string>[number]
type ToolResultPart = Extract<
  Exclude<Extract<ModelMessage, { role: "tool" }>["content"], string>[number],
  { type: "tool-result" }
>
type ProviderOptions = AssistantMessage["providerOptions"]
const options = (value: unknown) => (value === undefined ? {} : { providerOptions: value as ProviderOptions })

/** A part of an assistant message in the AI SDK's form (results are the tool message's). */
const toAssistantPart = (part: MessagePart): Array<AssistantContentPart> => {
  switch (part.type) {
    case "text":
      return [{ type: "text", text: part.text }]
    case "reasoning":
      return [{ type: "reasoning", text: part.text, ...options(part.providerOptions) }]
    case "tool-call":
      return [
        {
          type: "tool-call",
          toolCallId: part.id,
          toolName: part.tool,
          input: part.input,
          ...options(part.providerOptions),
        },
      ]
    case "tool-result":
      return []
  }
}

/** A call's result in the AI SDK's form: denied calls did not run, failed ones are errors. */
const toToolResult = (part: MessagePart): Array<ToolResultPart> =>
  part.type === "tool-result"
    ? [
        {
          type: "tool-result",
          toolCallId: part.id,
          toolName: part.tool,
          output:
            part.decision === "denied"
              ? { type: "execution-denied", reason: part.text }
              : part.ok
                ? { type: "text", value: part.text }
                : { type: "error-text", value: part.text },
        },
      ]
    : []

const toModelMessage = (message: PromptMessage): ModelMessage => {
  switch (message.role) {
    case "user":
      return {
        role: "user",
        content: message.parts.flatMap((part) =>
          part.type === "text" ? [{ type: "text" as const, text: part.text }] : [],
        ),
      }
    case "assistant":
      return { role: "assistant", content: message.parts.flatMap(toAssistantPart) }
    case "tool":
      return { role: "tool", content: message.parts.flatMap(toToolResult) }
  }
}

/** Stored messages in the AI SDK's form. */
export const toModelMessages = (messages: ReadonlyArray<PromptMessage>): Array<ModelMessage> =>
  messages.map(toModelMessage)

/** A reply in the AI SDK's form, as stored parts. */
export const fromResponse = (messages: ReadonlyArray<ModelMessage>): Array<ReplyPart> =>
  messages.flatMap((message) => {
    if (message.role !== "assistant") return []
    if (typeof message.content === "string")
      return message.content === "" ? [] : [{ type: "text" as const, text: message.content }]
    return message.content.flatMap((part): Array<ReplyPart> => {
      const provider =
        "providerOptions" in part && part.providerOptions !== undefined
          ? { providerOptions: part.providerOptions as never }
          : {}
      switch (part.type) {
        case "text":
          return part.text === "" ? [] : [{ type: "text", text: part.text }]
        case "reasoning":
          return [{ type: "reasoning", text: part.text, ...provider }]
        case "tool-call":
          return [
            { type: "tool-call", id: part.toolCallId, tool: part.toolName, input: part.input as never, ...provider },
          ]
        default:
          return []
      }
    })
  })

/**
 * Headers naming the conversation, for providers that ask for them: OpenCode Go routes and caches
 * prompts by a stable session id per conversation.
 */
const sessionHeaders =
  (settings: ModelSettings) =>
  (session: string): Record<string, string> =>
    settings.provider === "opencode-go" ? { "x-opencode-session": session } : {}

const stepWith =
  (model: LanguageModel, headersFor: (session: string) => Record<string, string>): Model["Service"]["step"] =>
  ({ system, messages, tools, session }) =>
    Stream.unwrap(
      Effect.acquireRelease(
        Effect.sync(() => new AbortController()),
        (controller) => Effect.sync(() => controller.abort()),
      ).pipe(
        Effect.map((controller) => {
          const result = streamText({
            model,
            system,
            messages: toModelMessages(messages),
            headers: headersFor(session),
            // No `execute`: the model asks, the service runs (and asks the person first for changes).
            tools: Object.fromEntries(
              tools.map((each) => [
                each.name,
                tool({ description: each.description, inputSchema: jsonSchema(each.input) }),
              ]),
            ),
            abortSignal: controller.signal,
            // Errors come through the stream, to the turn; the library's console output would only repeat them.
            onError: () => {},
          })
          const text = Stream.fromAsyncIterable(
            result.fullStream,
            (cause) => new ModelError({ message: describe(cause), cause }),
          ).pipe(
            Stream.flatMap(
              (part): Stream.Stream<StepEvent, ModelError> =>
                part.type === "error"
                  ? Stream.fail(new ModelError({ message: describe(part.error), cause: part.error }))
                  : part.type === "text-delta"
                    ? Stream.make({ type: "text", text: part.text })
                    : Stream.empty,
            ),
          )
          const reply = Stream.fromEffect(
            Effect.tryPromise({
              try: () => Promise.resolve(result.response),
              catch: (cause) => new ModelError({ message: describe(cause), cause }),
            }).pipe(Effect.map((response): StepEvent => ({ type: "reply", parts: fromResponse(response.messages) }))),
          )
          return Stream.concat(text, reply)
        }),
      ),
    )

const completeWith =
  (model: LanguageModel, headersFor: (session: string) => Record<string, string>): Model["Service"]["complete"] =>
  ({ system, prompt, session }) =>
    Effect.tryPromise({
      try: (signal) => generateText({ model, system, prompt, headers: headersFor(session), abortSignal: signal }),
      catch: (cause) => new ModelError({ message: describe(cause), cause }),
    }).pipe(Effect.map((result) => result.text))

const describe = (cause: unknown) => (cause instanceof Error ? cause.message : String(cause))
