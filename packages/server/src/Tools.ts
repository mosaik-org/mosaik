import { AgentTool, type AnyApp, type PermissionKey, RequiredPermission } from "@mosaik/core"
import {
  AGENT_TOOL_NAME_MAX,
  AppTool,
  AppTools,
  agentToolName,
  type JsonSchemaDocument,
} from "@mosaik/platform/contract"
import { Context, Option, Schema } from "effect"
import { HttpApi, type HttpApiEndpoint, type HttpApiGroup } from "effect/http-api"

const document = (schema: Schema.Top): JsonSchemaDocument => {
  const { schema: root, definitions } = Schema.toJsonSchemaDocument(schema)
  return { schema: root as Schema.Json, definitions: (definitions ?? {}) as Record<string, Schema.Json> }
}

/** The endpoint's JSON payload, if it takes one (tools send JSON: no files, forms or raw bytes). */
const jsonPayload = (endpoint: HttpApiEndpoint.Top): Option.Option<Schema.Top> | "unsupported" => {
  if (endpoint.payload.size === 0) return Option.none()
  const json = endpoint.payload.get("application/json")
  if (json === undefined || json.encoding._tag !== "Json" || json.schemas.length !== 1) return "unsupported"
  return Option.some(json.schemas[0])
}

/**
 * The app's tools for AI clients: the endpoints its contract annotates with `AgentTool`, each
 * with what calling it takes (its permission) and the JSON forms of its inputs. Served by
 * `runApp` at `TOOLS_PATH` for Mosaik's MCP server.
 */
export const appTools = <Id extends string, Groups extends HttpApiGroup.Constraint>(
  app: AnyApp,
  api: HttpApi.HttpApi<Id, Groups>,
): AppTools => {
  const tools: Array<AppTool> = []
  HttpApi.reflect(api, {
    onGroup: () => {},
    onEndpoint: ({ group, endpoint, mergedAnnotations }) => {
      const spec = Context.getOption(mergedAnnotations, AgentTool)
      if (Option.isNone(spec)) return
      const name = `${group.identifier}.${endpoint.identifier}`
      if (agentToolName(app.id, name).length > AGENT_TOOL_NAME_MAX) {
        throw new Error(`${app.id}: ${name} is offered to AI clients, but its name is too long for them`)
      }
      const payload = jsonPayload(endpoint)
      if (payload === "unsupported") {
        throw new Error(`${app.id}: ${name} is offered to AI clients, but only endpoints taking JSON can be`)
      }
      const permission: PermissionKey = Option.getOrElse(
        Context.getOption(mergedAnnotations, RequiredPermission),
        () => app.accessPermission,
      )
      const declared = app.permissions[permission.slice(app.id.length + 1)]
      tools.push(
        new AppTool({
          name,
          title: spec.value.title ?? name,
          description: spec.value.description,
          examples: spec.value.examples ?? [],
          method: endpoint.method as AppTool["method"],
          path: endpoint.path,
          permission,
          readOnly: endpoint.method === "GET",
          destructive: declared?.dangerous === true,
          params: endpoint.params === undefined ? null : document(endpoint.params),
          query: endpoint.query === undefined ? null : document(endpoint.query),
          payload: Option.match(payload, { onNone: () => null, onSome: document }),
        }),
      )
    },
  })
  return new AppTools({ app: app.id, tools })
}
