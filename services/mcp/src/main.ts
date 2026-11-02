import { runMain, serve } from "@mosaik/server"
import { Layer } from "effect"
import { AgentTokens, AppCalls } from "./AppCalls"
import { Catalog } from "./Catalog"
import * as Routes from "./Routes"

/**
 * Mosaik's MCP server: people's AI clients use the tools apps offer (`AgentTool`) through it,
 * as the person who connected them. Reached through the gateway at `/mcp`.
 */
const Main = serve(Routes.layer, { name: "mosaik-mcp", port: 3000 }).pipe(
  Layer.provide(AppCalls.layer),
  Layer.provide([Catalog.layer, AgentTokens.layer]),
)

runMain(Main)
