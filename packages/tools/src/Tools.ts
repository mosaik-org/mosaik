import type { AppTool, JsonSchemaDocument } from "@mosaik/platform/contract"
import { Result, type Schema } from "effect"

/**
 * How an app's tools (`AppTool`, from its contract) are offered to an AI, whatever reaches it (the
 * MCP server, the assistant): their input as one JSON Schema, a call back into an HTTP request to
 * the app, and the app's answer as what the AI reads. Pure: no I/O, so it is tested on its own.
 */

/** A JSON Schema object for a tool's input. */
export interface InputSchema extends Schema.JsonObject {
  readonly type: "object"
  readonly properties: Readonly<Record<string, Schema.JsonObject>>
  readonly required: ReadonlyArray<string>
}

/** What a tool takes, grouped as the endpoint does: path parameters, query and JSON body. */
export interface ToolArguments {
  readonly path?: Readonly<Record<string, unknown>> | undefined
  readonly query?: Readonly<Record<string, unknown>> | undefined
  readonly body?: unknown
}

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

/** Whether a JSON Schema document requires some property (a `$ref` root is treated as requiring one). */
const requiresSomething = (document: JsonSchemaDocument): boolean => {
  const root = document.schema
  if (!isRecord(root)) return false
  if (typeof root.$ref === "string") return true
  return Array.isArray(root.required) && root.required.length > 0
}

/**
 * The tool's input: one object with `path`, `query` and `body`, each when the endpoint has it.
 * Their definitions are gathered in the root's `$defs`, where their `$ref`s point.
 */
export const inputSchema = (tool: AppTool): InputSchema => {
  const properties: Record<string, Schema.JsonObject> = {}
  const required: Array<string> = []
  const definitions: Record<string, Schema.Json> = {}
  const add = (key: keyof ToolArguments, document: JsonSchemaDocument | null, description: string) => {
    if (document === null) return
    const schema = isRecord(document.schema) ? (document.schema as Schema.JsonObject) : {}
    properties[key] = { ...schema, description }
    Object.assign(definitions, document.definitions)
    if (key !== "query" || requiresSomething(document)) required.push(key)
  }
  add("path", tool.params, "Path parameters")
  add("query", tool.query, "Query parameters")
  add("body", tool.payload, "The request body")
  return {
    type: "object",
    properties,
    required,
    additionalProperties: false,
    ...(Object.keys(definitions).length > 0 ? { $defs: definitions } : {}),
  }
}

/** The request a call makes: relative to the app's address. */
export interface ToolRequest {
  readonly method: AppTool["method"]
  readonly url: string
  readonly body: string | undefined
}

/** Query and path values: what a URL carries is text. */
const text = (value: unknown): string =>
  typeof value === "string" ? value : typeof value === "object" ? JSON.stringify(value) : String(value)

/**
 * The HTTP request for a call, or why the arguments cannot make one. Everything else (types,
 * limits, required fields) the app checks, and its answer goes back to the AI.
 */
export const toRequest = (tool: AppTool, args: unknown): Result.Result<ToolRequest, string> => {
  const input: ToolArguments = isRecord(args) ? args : {}
  const params = isRecord(input.path) ? input.path : {}
  const missing: Array<string> = []
  const path = tool.path.replace(/:(\w+)/g, (_, name: string) => {
    const value = params[name]
    if (value === undefined || value === null || value === "") missing.push(name)
    return encodeURIComponent(text(value))
  })
  if (missing.length > 0) return Result.fail(`Missing path parameters: ${missing.join(", ")}`)

  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(isRecord(input.query) ? input.query : {})) {
    if (value === undefined || value === null) continue
    for (const item of Array.isArray(value) ? value : [value]) query.append(key, text(item))
  }
  const search = query.size > 0 ? `?${query}` : ""

  if (tool.payload !== null && input.body === undefined) return Result.fail("Missing the request body (`body`)")
  return Result.succeed({
    method: tool.method,
    url: path + search,
    body: tool.payload === null ? undefined : JSON.stringify(input.body),
  })
}

/** Large answers would fill the AI's context: past this, they are cut, with a note. */
export const MAX_RESULT_CHARACTERS = 60_000

/** What a call came to, as the AI reads it: text, and whether the call failed. */
export interface ToolOutcome {
  readonly ok: boolean
  readonly text: string
}

/** What the AI gets for the app's answer: its body as text, marked as failed unless it succeeded. */
export const toOutcome = (status: number, body: string): ToolOutcome => {
  const ok = status >= 200 && status < 300
  const shown =
    body.length > MAX_RESULT_CHARACTERS
      ? `${body.slice(0, MAX_RESULT_CHARACTERS)}\n[Cut after ${MAX_RESULT_CHARACTERS} of ${body.length} characters: ask for less, e.g. a smaller page or narrower filters]`
      : body
  const content = ok ? (shown === "" ? "Done." : shown) : `The app answered ${status}: ${shown || "(no details)"}`
  return { ok, text: content }
}

/** A call that failed before reaching the app (or could not reach it), and why. */
export const failure = (text: string): ToolOutcome => ({ ok: false, text })
