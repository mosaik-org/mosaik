import { createHash } from "node:crypto"
import { AGENT_RESOURCE_PATH, type AgentTokenClaims } from "@mosaik/auth/contract"
import { Principal } from "@mosaik/core"
import { Context, Duration, Effect, Equal, Hash, Layer, RcMap, type Scope } from "effect"
import { McpProtocol, McpServer } from "effect/ai"
import { HttpRouter, type HttpServerError, type HttpServerRequest, type HttpServerResponse } from "effect/http"
import { AppCalls } from "./AppCalls"
import { Catalog, type CatalogTool } from "./Catalog"

/** What AI clients learn about the server when they connect. */
const INSTRUCTIONS =
  "Tools of the company's internal apps in Mosaik. Every call runs as the signed-in person, " +
  "with their permissions, and is recorded in Mosaik's audit log as theirs."

/** How long a person's server stays after their last request. */
const IDLE = Duration.minutes(15)

/**
 * Whose server, with which tools. Equal when the connection and the tools AI clients see are:
 * a change of permissions or of an app's tools makes another key, so another server.
 */
class ServerKey implements Equal.Equal {
  readonly fingerprint: string
  constructor(
    readonly connection: string,
    readonly tools: ReadonlyArray<CatalogTool>,
  ) {
    const hash = createHash("sha256")
    for (const tool of tools) hash.update(tool.fingerprint)
    this.fingerprint = hash.digest("base64url")
  }
  [Equal.symbol](that: unknown): boolean {
    return that instanceof ServerKey && that.connection === this.connection && that.fingerprint === this.fingerprint
  }
  [Hash.symbol](): number {
    return Hash.string(`${this.connection}\n${this.fingerprint}`)
  }
}

/**
 * An MCP server for each connected AI client, listing only the tools its person may call.
 *
 * Effect's MCP server lists the same tools to every client, so each connection gets its own
 * (created on first use, closed after {@link IDLE} unused). When someone's tools change, their
 * requests reach a new server: AI clients on a sessionful protocol revision get "session not
 * found" for the old one and connect again, which is how they learn about the new tools.
 */
export class AgentServers extends Context.Service<
  AgentServers,
  {
    /** Answers the current request with the server of the token's connection. */
    readonly handle: (
      claims: AgentTokenClaims,
    ) => Effect.Effect<
      HttpServerResponse.HttpServerResponse,
      HttpServerError.HttpServerError,
      HttpServerRequest.HttpServerRequest | Scope.Scope
    >
  }
>()("@mosaik/mcp/AgentServers") {
  static readonly layer = Layer.effect(
    AgentServers,
    Effect.gen(function* () {
      const catalog = yield* Catalog
      const calls = yield* AppCalls

      const serve = (key: ServerKey) => {
        const tools = Layer.effectDiscard(
          Effect.gen(function* () {
            const server = yield* McpServer.McpServer
            for (const tool of key.tools) {
              yield* server.addTool({
                tool: tool.definition,
                annotations: Context.empty(),
                handle: (args) => calls.call(key.connection, tool, args),
              })
            }
          }),
        )
        return HttpRouter.toHttpEffect(
          tools.pipe(
            Layer.provideMerge(
              McpServer.layerHttp({
                name: "Mosaik",
                version: "1.0.0",
                instructions: INSTRUCTIONS,
                path: AGENT_RESOURCE_PATH,
                protocols: [McpProtocol.v2026_07_28, McpProtocol.v2025_11_25, McpProtocol.v2025_06_18],
                // Clients end their sessions; only their own, as every request is authenticated first.
                allowSessionTermination: true,
              }),
            ),
          ),
        ).pipe(Effect.orDie)
      }

      const servers = yield* RcMap.make({ lookup: serve, idleTimeToLive: IDLE })

      return AgentServers.of({
        handle: Effect.fn("AgentServers.handle")(function* (claims) {
          const tools = yield* catalog.visibleTo(new Principal({ user: claims.user, grants: claims.grants }))
          const handler = yield* RcMap.get(servers, new ServerKey(claims.connection, tools))
          return yield* handler
        }),
      })
    }),
  )
}
