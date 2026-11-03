import { InternalClient } from "@mosaik/auth/server"
import { type Caller, type CatalogTool, type ToolOutcome, WhatNeedsMe } from "@mosaik/tools"
import { Context, Effect, Layer, Option } from "effect"
import { McpSchema } from "effect/ai"

/** The tool as AI clients list it, with hints on what it changes. */
export const toMcpTool = (tool: CatalogTool): McpSchema.Tool =>
  McpSchema.Tool.make({
    name: tool.name,
    title: tool.tool.title,
    description: tool.tool.description,
    inputSchema: tool.input,
    annotations: McpSchema.ToolAnnotations.make({
      title: tool.tool.title,
      readOnlyHint: tool.tool.readOnly,
      destructiveHint: tool.tool.destructive,
      idempotentHint: tool.tool.method === "GET" || tool.tool.method === "PUT" || tool.tool.method === "DELETE",
      // Only the company's own apps: nothing outside Mosaik.
      openWorldHint: false,
    }),
  })

/** Mosaik's own tool, as AI clients list it: what waits for the person, changing nothing. */
export const whatNeedsMeTool: McpSchema.Tool = McpSchema.Tool.make({
  name: WhatNeedsMe.name,
  title: WhatNeedsMe.title,
  description: WhatNeedsMe.description,
  inputSchema: WhatNeedsMe.input,
  annotations: McpSchema.ToolAnnotations.make({
    title: WhatNeedsMe.title,
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  }),
})

/** A call's outcome as MCP clients read it: its text, and `isError` when it failed. */
export const toCallToolResult = (outcome: ToolOutcome): McpSchema.CallToolResult =>
  McpSchema.CallToolResult.make({
    content: [McpSchema.TextContent.make({ type: "text", text: outcome.text })],
    ...(outcome.ok ? {} : { isError: true }),
  })

/**
 * Who an AI client's calls are made for: the person of its connection. The auth service checks
 * the connection on every call, so a revoked one stops working at once, and the grants are always
 * current.
 */
export class ConnectionCallers extends Context.Service<
  ConnectionCallers,
  { readonly forConnection: (connection: string) => Caller }
>()("@mosaik/mcp/ConnectionCallers") {
  static readonly layer = Layer.effect(
    ConnectionCallers,
    Effect.gen(function* () {
      const client = yield* InternalClient
      return ConnectionCallers.of({
        forConnection: (connection) => ({
          key: connection,
          token: (app) =>
            client.internal.issueAgentToken({ payload: { connection, audience: app } }).pipe(
              Effect.map((issued) => Option.some(issued.token)),
              Effect.catchTag("Unauthorized", () => Effect.succeedNone),
              Effect.orDie,
            ),
        }),
      })
    }),
  ).pipe(Layer.provide(InternalClient.layer))
}
