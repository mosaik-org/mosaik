/**
 * Apps' tools for AI: the endpoints apps offer with `AgentTool`, as one catalog kept up to date
 * from the platform's registry, and calls to them as a person. Mosaik's MCP server and the
 * assistant both offer them, each to its own AI.
 */
export { AppCalls, type Caller } from "./AppCalls"
export { Catalog, type CatalogTool } from "./Catalog"
export {
  failure,
  type InputSchema,
  inputSchema,
  MAX_RESULT_CHARACTERS,
  type ToolArguments,
  type ToolOutcome,
  type ToolRequest,
  toOutcome,
  toRequest,
} from "./Tools"
