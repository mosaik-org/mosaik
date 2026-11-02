import { Effect } from "effect"
import { SqlClient } from "effect/sql"

/**
 * Sign-in for AI clients (Mosaik's MCP server):
 *
 * - `agent_clients`: clients that registered themselves (RFC 7591). Clients identified by a
 *   client ID metadata document are not stored: their document is read at each sign-in.
 * - `agent_codes`: one-time codes, with the PKCE challenge they must be exchanged with.
 * - `agent_connections`: an AI client someone allowed, with its refresh token. Like standalone
 *   apps' refresh tokens, it lasts as long as the Core session it was allowed in.
 *
 * Only hashes of codes and tokens are stored.
 */
export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* sql`
    CREATE TABLE agent_clients (
      id text PRIMARY KEY,
      name text NOT NULL,
      redirect_uris text[] NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      -- Set when someone allows it: registrations nobody uses are cleared out.
      last_used_at timestamptz
    )
  `
  yield* sql`
    CREATE TABLE agent_codes (
      code_hash text PRIMARY KEY,
      client_id text NOT NULL,
      client_name text NOT NULL,
      session_id text NOT NULL REFERENCES session (id) ON DELETE CASCADE,
      redirect_uri text NOT NULL,
      code_challenge text NOT NULL,
      expires_at timestamptz NOT NULL
    )
  `
  yield* sql`
    CREATE TABLE agent_connections (
      id text PRIMARY KEY,
      user_id text NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
      session_id text NOT NULL REFERENCES session (id) ON DELETE CASCADE,
      client_id text NOT NULL,
      client_name text NOT NULL,
      refresh_token_hash text NOT NULL UNIQUE,
      created_at timestamptz NOT NULL DEFAULT now(),
      last_used_at timestamptz NOT NULL DEFAULT now()
    )
  `
  yield* sql`CREATE INDEX agent_connections_user_idx ON agent_connections (user_id, client_id)`
  yield* sql`CREATE INDEX agent_connections_session_idx ON agent_connections (session_id)`
})
