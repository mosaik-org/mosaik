import { runMain, serve } from "@mosaik/server"
import { AppCalls, Catalog, PersonStatuses } from "@mosaik/tools"
import { Layer } from "effect"
import { ConnectionCallers } from "./McpTools"
import * as Routes from "./Routes"

/**
 * Mosaik's MCP server: people's AI clients use the tools apps offer (`AgentTool`) through it,
 * as the person who connected them. Reached through the gateway at `/mcp`.
 */
const Main = serve(Routes.layer, { name: "mosaik-mcp", port: 3000 }).pipe(
  Layer.provide(AppCalls.layer),
  Layer.provide([Catalog.layer, ConnectionCallers.layer, PersonStatuses.layer]),
)

runMain(Main)
