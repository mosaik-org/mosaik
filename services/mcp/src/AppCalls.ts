import { InternalClient } from "@mosaik/auth/server"
import { Clock, Config, Context, Duration, Effect, Layer, Option, Result } from "effect"
import type { McpSchema } from "effect/ai"
import { FetchHttpClient, HttpBody, HttpClient, HttpClientRequest } from "effect/http"
import { textResult, toRequest, toResult } from "./AgentTools"
import type { CatalogTool } from "./Catalog"

/**
 * Tokens to call apps as the person of a connection. The auth service checks the connection
 * on every call, so a revoked one stops working at once, and the grants are always current.
 */
export class AgentTokens extends Context.Service<
  AgentTokens,
  {
    /** A token for the app, or `None` when the connection was revoked or its session ended. */
    readonly forApp: (connection: string, app: string) => Effect.Effect<Option.Option<string>>
  }
>()("@mosaik/mcp/AgentTokens") {
  static readonly layer = Layer.effect(
    AgentTokens,
    Effect.gen(function* () {
      const client = yield* InternalClient
      return AgentTokens.of({
        forApp: (connection, app) =>
          client.internal.issueAgentToken({ payload: { connection, audience: app } }).pipe(
            Effect.map((issued) => Option.some(issued.token)),
            Effect.catchTag("Unauthorized", () => Effect.succeedNone),
            Effect.orDie,
          ),
      })
    }),
  ).pipe(Layer.provide(InternalClient.layer))
}

/** How long an app may take to answer a call. */
const CALL_TIMEOUT = Duration.seconds(30)

/**
 * Tool calls, made as the person of the connection: with a token for the app, straight to the
 * app's backend (as the gateway would forward them), so the app checks permissions, validates
 * and audits as for any request. Each connection may make `MCP_CALLS_PER_MINUTE` calls a minute.
 */
export class AppCalls extends Context.Service<
  AppCalls,
  { readonly call: (connection: string, tool: CatalogTool, args: unknown) => Effect.Effect<McpSchema.CallToolResult> }
>()("@mosaik/mcp/AppCalls") {
  static readonly layer = Layer.effect(
    AppCalls,
    Effect.gen(function* () {
      const tokens = yield* AgentTokens
      const http = yield* HttpClient.HttpClient
      const perMinute = yield* Config.Int("MCP_CALLS_PER_MINUTE").pipe(Config.withDefault(120))
      // Calls in the current minute, per connection. Fixed windows: simple, and enough against runaway loops.
      const windows = new Map<string, { readonly minute: number; count: number }>()

      const allow = Effect.fn(function* (connection: string) {
        const minute = Math.floor((yield* Clock.currentTimeMillis) / 60_000)
        const window = windows.get(connection)
        if (window === undefined || window.minute !== minute) {
          // Old windows of every connection go with the minute.
          for (const [key, old] of windows) if (old.minute !== minute) windows.delete(key)
          windows.set(connection, { minute, count: 1 })
          return true
        }
        window.count++
        return window.count <= perMinute
      })

      return AppCalls.of({
        call: Effect.fn("AppCalls.call")(function* (connection, tool, args) {
          yield* Effect.annotateCurrentSpan({ "mosaik.app": tool.app, "mosaik.tool": tool.name })
          if (!(yield* allow(connection))) {
            return textResult(`Too many calls: at most ${perMinute} a minute. Wait a minute before trying again.`, true)
          }
          const request = toRequest(tool.tool, args)
          if (Result.isFailure(request)) return textResult(request.failure, true)
          const token = yield* tokens.forApp(connection, tool.app)
          if (Option.isNone(token)) {
            return textResult("This connection to Mosaik was revoked or has expired: sign in to Mosaik again.", true)
          }
          const { method, url, body } = request.success
          return yield* http
            .execute(
              HttpClientRequest.make(method)(new URL(url, tool.upstream)).pipe(
                HttpClientRequest.bearerToken(token.value),
                HttpClientRequest.acceptJson,
                body === undefined
                  ? (request) => request
                  : HttpClientRequest.setBody(HttpBody.text(body, "application/json")),
              ),
            )
            .pipe(
              Effect.flatMap((response) => Effect.map(response.text, (text) => toResult(response.status, text))),
              Effect.timeout(CALL_TIMEOUT),
              Effect.catch((error) =>
                Effect.as(
                  Effect.logWarning(`Calling ${tool.name} failed`, error),
                  textResult(`${tool.app} did not answer. Try again later.`, true),
                ),
              ),
            )
        }),
      })
    }),
  ).pipe(Layer.provide(FetchHttpClient.layer))
}
