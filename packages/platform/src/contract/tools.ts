import { PermissionKey } from "@mosaik/core"
import { Schema } from "effect"
import { AppId } from "./manifest"

/**
 * Where every app serves its tools for AI clients (relative to its base URL): the endpoints its
 * contract offers with `AgentTool`. Mosaik's MCP server reads them.
 */
export const TOOLS_PATH = "/.well-known/mosaik-tools.json"

/**
 * What AI clients call a tool: `<app>_<group>_<endpoint>`, e.g. `sales_orders_refund`. MCP clients
 * accept letters, digits, `_` and `-`, up to 64 characters (`runApp` refuses longer names).
 */
export const agentToolName = (app: string, tool: string): string => `${app}_${tool}`.replace(/[^A-Za-z0-9_-]/g, "_")
export const AGENT_TOOL_NAME_MAX = 64

/** A JSON Schema document (draft 2020-12) with its definitions, as `Schema.toJsonSchemaDocument` makes it. */
export const JsonSchemaDocument = Schema.Struct({
  schema: Schema.Json,
  definitions: Schema.Record(Schema.String, Schema.Json),
})
export type JsonSchemaDocument = typeof JsonSchemaDocument.Type

/** An endpoint offered to AI clients: how to call it, and what it needs. */
export class AppTool extends Schema.Class<AppTool>("@mosaik/platform/AppTool")({
  /** `<group>.<endpoint>` in the app's contract, e.g. `orders.refund`. */
  name: Schema.String,
  title: Schema.String,
  description: Schema.String,
  method: Schema.Literals(["GET", "POST", "PUT", "PATCH", "DELETE"]),
  /** The full path, with `:params`, e.g. `/api/sales/orders/:id/refund`. */
  path: Schema.String,
  /** What calling it takes: its `RequiredPermission`, or the app's access permission. */
  permission: PermissionKey,
  /** Changes nothing (a `GET`). */
  readOnly: Schema.Boolean,
  /** Needs a permission the manifest marks dangerous: clients ask before calling it. */
  destructive: Schema.Boolean,
  /** The JSON forms of its path parameters, query and payload, each when it has one. */
  params: Schema.NullOr(JsonSchemaDocument),
  query: Schema.NullOr(JsonSchemaDocument),
  payload: Schema.NullOr(JsonSchemaDocument),
}) {}

/** What an app serves at {@link TOOLS_PATH}. */
export class AppTools extends Schema.Class<AppTools>("@mosaik/platform/AppTools")({
  app: AppId,
  tools: Schema.Array(AppTool),
}) {}
