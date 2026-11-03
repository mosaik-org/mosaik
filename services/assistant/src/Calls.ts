import {
  BrowserTools,
  isBrowserTool,
  type Message,
  type Resolution,
  type ToolCallPart,
} from "@mosaik/assistant/contract"
import type { CatalogTool, InputSchema } from "@mosaik/tools"
import { Result, Schema } from "effect"
import type { ModelTool, ReplyPart } from "./Model"

/**
 * The model's tool calls between asking and answering: what waits, for whom, and whether what
 * the person or the browser sends resolves it. Pure, so the rules are tested on their own.
 */

/**
 * Calls that wait to be resolved: changes, for the person's decision, and browser tools, for the
 * browser to run them; until a result is stored for them.
 */
export const pendingCalls = (messages: ReadonlyArray<Message>): ReadonlyArray<ToolCallPart> => {
  const answered = new Set(
    messages.flatMap((message) => message.parts.flatMap((part) => (part.type === "tool-result" ? [part.id] : []))),
  )
  return messages.flatMap((message) =>
    message.role === "assistant"
      ? message.parts.flatMap((part) =>
          part.type === "tool-call" && (part.changes || part.runsIn === "browser") && !answered.has(part.id)
            ? [part]
            : [],
        )
      : [],
  )
}

/**
 * Model steps taken since the person last wrote: the limit counts from there, however many
 * requests (decisions, browser results) the turn took.
 */
export const stepsSinceQuestion = (messages: ReadonlyArray<Message>): number => {
  const asked = messages.findLastIndex((message) => message.role === "user")
  return messages.slice(asked + 1).filter((message) => message.role === "assistant").length
}

/**
 * Pairs each resolution with the waiting call it resolves, or says why it cannot: a call that
 * does not wait, one resolved twice, a decision on a browser tool or a result for a change.
 */
export const matchResolutions = (
  pending: ReadonlyArray<ToolCallPart>,
  resolutions: ReadonlyArray<Resolution>,
): Result.Result<ReadonlyArray<readonly [ToolCallPart, Resolution]>, string> => {
  const seen = new Set<string>()
  const matched: Array<readonly [ToolCallPart, Resolution]> = []
  for (const resolution of resolutions) {
    const call = pending.find((each) => each.id === resolution.call)
    if (call === undefined) return Result.fail(`No call ${resolution.call} waits to be resolved`)
    if (seen.has(call.id)) return Result.fail(`Call ${call.id} is resolved twice`)
    seen.add(call.id)
    const inBrowser = call.runsIn === "browser"
    if (resolution.type === "decision" && inBrowser) return Result.fail(`Call ${call.id} runs in the browser`)
    if (resolution.type === "result" && !inBrowser)
      return Result.fail(`Call ${call.id} waits for the person's decision`)
    matched.push([call, resolution])
  }
  return Result.succeed(matched)
}

const inputSchemaOf = (schema: Schema.Top): InputSchema => {
  const { schema: root, definitions } = Schema.toJsonSchemaDocument(schema)
  const hasDefinitions = definitions !== undefined && Object.keys(definitions).length > 0
  return { ...(root as InputSchema), ...(hasDefinitions ? { $defs: definitions as Schema.JsonObject } : {}) }
}

/** The browser tools, as the model is given them. */
export const browserModelTools: ReadonlyArray<ModelTool> = Object.entries(BrowserTools).map(([name, tool]) => ({
  name,
  description: tool.description,
  input: inputSchemaOf(tool.input),
}))

/**
 * The tools the model may call: the person's apps' tools and the browser tools. An app's tool
 * named like a browser tool is left out; the browser's are the assistant's own.
 */
export const modelTools = (visible: ReadonlyArray<CatalogTool>): ReadonlyArray<ModelTool> => [
  ...visible
    .filter((tool) => !isBrowserTool(tool.name))
    .map((tool) => ({ name: tool.name, description: tool.tool.description, input: tool.input })),
  ...browserModelTools,
]

/** Completes the model's tool call with what the person needs to judge it, and where it runs. */
export const describeCall = (
  part: Extract<ReplyPart, { readonly type: "tool-call" }>,
  tools: ReadonlyMap<string, CatalogTool>,
): ToolCallPart => {
  if (isBrowserTool(part.tool)) {
    return {
      ...part,
      title: BrowserTools[part.tool].title,
      app: "",
      changes: false,
      destructive: false,
      runsIn: "browser",
    }
  }
  const tool = tools.get(part.tool)
  return {
    ...part,
    title: tool?.tool.title ?? part.tool,
    app: tool?.app ?? "",
    changes: tool !== undefined && !tool.tool.readOnly,
    destructive: tool?.tool.destructive ?? false,
  }
}
