import { Principal, PrincipalUser } from "@mosaik/core"
import { Schema } from "effect"

/**
 * Mosaik's MCP server (`services/mcp`), through which people's AI clients use the tools apps
 * offer (`AgentTool`): its address on Core's public URL, and the OAuth protected-resource
 * metadata (RFC 9728) that tells clients where to sign in.
 */
export const AGENT_RESOURCE_PATH = "/mcp"
export const PROTECTED_RESOURCE_METADATA_PATH = `/.well-known/oauth-protected-resource${AGENT_RESOURCE_PATH}`

/** The audience of AI clients' access tokens: the MCP server. */
export const AGENT_AUDIENCE = "mcp"

/**
 * Claims of an AI client's access token: whose it is and their grants everywhere (the MCP server
 * lists their tools across apps), and the connection it belongs to, which the MCP server names
 * when it asks for a token to call an app (`issueAgentToken`).
 */
export const AgentTokenClaims = Schema.Struct({
  user: PrincipalUser,
  grants: Principal.fields.grants,
  connection: Schema.String,
})
export type AgentTokenClaims = typeof AgentTokenClaims.Type

/**
 * Core's sign-in for AI clients (OAuth 2.1, authorization code with PKCE, public clients), on
 * Core's public URL. Clients find these addresses in the authorization server metadata
 * (RFC 8414) and identify themselves either by registering (RFC 7591) or by the address of a
 * client ID metadata document they publish.
 */
export const AUTHORIZATION_SERVER_METADATA_PATH = "/.well-known/oauth-authorization-server"
export const AGENT_AUTHORIZE_PATH = "/api/auth/agents/authorize"
export const AGENT_TOKEN_PATH = "/api/auth/agents/token"
export const AGENT_REGISTER_PATH = "/api/auth/agents/register"
export const AGENT_REVOKE_PATH = "/api/auth/agents/revoke"

/** Core's page where people see the AI clients they connected, and disconnect them. */
export const AGENT_CONNECTIONS_PATH = "/api/auth/agents/connections"

/** How long an AI client's access token lasts; it refreshes it while the connection lasts. */
export const AGENT_TOKEN_TTL_SECONDS = 600
