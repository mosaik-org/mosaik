import { createHash, randomBytes } from "node:crypto"
import { PgClient } from "@effect/sql-pg"
import { AGENT_AUDIENCE, AGENT_TOKEN_TTL_SECONDS, type IssuedToken, type OAuthTokens } from "@mosaik/auth/contract"
import { scopeGrants, Unauthorized, UserId } from "@mosaik/core"
import { Context, Duration, Effect, Layer, Option } from "effect"
import { InvalidGrant } from "../OAuth"
import { Access } from "../rbac/Access"
import { Users } from "../rbac/Users"
import { SigningKeys } from "../SigningKeys"
import type { AgentClient } from "./AgentClients"

/** How long an authorization code can be exchanged. */
const CODE_TTL = Duration.minutes(1)

const secret = () => randomBytes(32).toString("base64url")
const hash = (value: string) => createHash("sha256").update(value).digest("base64url")

/** PKCE S256 (RFC 7636): the challenge is the verifier's SHA-256, base64url. */
export const pkceChallenge = (verifier: string) => hash(verifier)

/** RFC 7636 §4.1: 43 to 128 characters of `[A-Za-z0-9-._~]`. */
const isVerifier = (verifier: string) => /^[A-Za-z0-9\-._~]{43,128}$/.test(verifier)

/**
 * AI clients people allowed (Mosaik's MCP server), each a connection: one-time codes with
 * PKCE, exchanged for an access token for the MCP server and a refresh token. Connections last
 * as long as the Core session they were allowed in, as standalone apps' sign-ins do, so
 * signing out of Core cuts AI clients off too. Only hashes are stored.
 */
export class AgentConnections extends Context.Service<
  AgentConnections,
  {
    /** A code for the client, for whoever is signed in with the session. */
    readonly issueCode: (options: {
      readonly client: AgentClient
      readonly sessionId: string
      readonly redirectUri: string
      readonly codeChallenge: string
    }) => Effect.Effect<string>
    /** A new connection for a code, if it is unused, for this client and redirect, and the verifier matches. */
    readonly exchangeCode: (options: {
      readonly clientId: string
      readonly code: string
      readonly redirectUri: string
      readonly codeVerifier: string
    }) => Effect.Effect<OAuthTokens, InvalidGrant>
    /** A new access token and refresh token (refresh tokens are used once: OAuth 2.1 for public clients). */
    readonly refresh: (clientId: string, refreshToken: string) => Effect.Effect<OAuthTokens, InvalidGrant>
    /** Ends the connection of a refresh token (RFC 7009). */
    readonly revokeToken: (clientId: string, refreshToken: string) => Effect.Effect<void>
    /** Whether the person already allowed the client (in a connection that still lasts). */
    readonly allowed: (userId: string, clientId: string) => Effect.Effect<boolean>
    /** A token for an app, as the connection's person, with their current grants. */
    readonly tokenForApp: (connection: string, app: string) => Effect.Effect<IssuedToken, Unauthorized>
  }
>()("@mosaik/auth-service/AgentConnections") {
  static readonly layer = Layer.effect(
    AgentConnections,
    Effect.gen(function* () {
      const sql = yield* PgClient.PgClient
      const keys = yield* SigningKeys
      const access = yield* Access
      const users = yield* Users

      /** The connection's person, while its session lasts. */
      const principalOf = Effect.fn(function* (connection: string) {
        const [row] = yield* sql<{ userId: string }>`
          SELECT c.user_id FROM agent_connections c JOIN session s ON s.id = c.session_id
          WHERE c.id = ${connection} AND s."expiresAt" > now()
        `.pipe(Effect.orDie)
        if (row === undefined) return Option.none()
        const [user] = yield* users.lookup([UserId.make(row.userId)])
        if (user === undefined) return Option.none()
        return Option.some(yield* access.principalFor(Option.some(user)))
      })

      const tokens = Effect.fn("AgentConnections.tokens")(function* (connection: string, refreshToken: string) {
        const principal = yield* principalOf(connection)
        if (Option.isNone(principal) || principal.value.user === null) {
          return yield* new InvalidGrant({ reason: "The session ended" })
        }
        const issued = yield* keys.sign(
          { user: principal.value.user, grants: principal.value.grants, connection },
          AGENT_AUDIENCE,
          AGENT_TOKEN_TTL_SECONDS,
        )
        return {
          access_token: issued.token,
          token_type: "Bearer",
          expires_in: AGENT_TOKEN_TTL_SECONDS,
          refresh_token: refreshToken,
        } as const
      })

      return AgentConnections.of({
        issueCode: Effect.fn("AgentConnections.issueCode")(function* ({
          client,
          sessionId,
          redirectUri,
          codeChallenge,
        }) {
          const code = secret()
          const expiresAt = new Date(Date.now() + Duration.toMillis(CODE_TTL))
          yield* sql`
            INSERT INTO agent_codes ${sql.insert({
              codeHash: hash(code),
              clientId: client.id,
              clientName: client.name,
              sessionId,
              redirectUri,
              codeChallenge,
              expiresAt,
            })}
          `.pipe(Effect.orDie)
          yield* sql`DELETE FROM agent_codes WHERE expires_at < now()`.pipe(Effect.orDie)
          return code
        }),

        exchangeCode: Effect.fn("AgentConnections.exchangeCode")(function* ({
          clientId,
          code,
          redirectUri,
          codeVerifier,
        }) {
          if (!isVerifier(codeVerifier))
            return yield* new InvalidGrant({ reason: "Missing or malformed code_verifier" })
          // Deleted as it is read: a code works once, even when two requests race.
          const [row] = yield* sql<{ sessionId: string; clientName: string; codeChallenge: string }>`
            DELETE FROM agent_codes
            WHERE code_hash = ${hash(code)} AND client_id = ${clientId} AND redirect_uri = ${redirectUri}
              AND expires_at > now()
            RETURNING session_id, client_name, code_challenge
          `.pipe(Effect.orDie)
          if (row === undefined) return yield* new InvalidGrant({ reason: "Unknown, used or expired code" })
          if (pkceChallenge(codeVerifier) !== row.codeChallenge) {
            return yield* new InvalidGrant({ reason: "The code_verifier does not match the code_challenge" })
          }
          const [session] = yield* sql<{ userId: string }>`
            SELECT "userId" AS user_id FROM session WHERE id = ${row.sessionId} AND "expiresAt" > now()
          `.pipe(Effect.orDie)
          if (session === undefined) return yield* new InvalidGrant({ reason: "The session ended" })
          const connection = randomBytes(16).toString("base64url")
          const refreshToken = secret()
          yield* sql`
            INSERT INTO agent_connections ${sql.insert({
              id: connection,
              userId: session.userId,
              sessionId: row.sessionId,
              clientId,
              clientName: row.clientName,
              refreshTokenHash: hash(refreshToken),
            })}
          `.pipe(Effect.orDie)
          return yield* tokens(connection, refreshToken)
        }),

        refresh: Effect.fn("AgentConnections.refresh")(function* (clientId, refreshToken) {
          const next = secret()
          const [row] = yield* sql<{ id: string }>`
            UPDATE agent_connections SET refresh_token_hash = ${hash(next)}, last_used_at = now()
            WHERE refresh_token_hash = ${hash(refreshToken)} AND client_id = ${clientId}
            RETURNING id
          `.pipe(Effect.orDie)
          if (row === undefined) return yield* new InvalidGrant({ reason: "Unknown, used or revoked refresh token" })
          return yield* tokens(row.id, next)
        }),

        revokeToken: (clientId, refreshToken) =>
          sql`
            DELETE FROM agent_connections WHERE refresh_token_hash = ${hash(refreshToken)} AND client_id = ${clientId}
          `.pipe(Effect.asVoid, Effect.orDie),

        allowed: (userId, clientId) =>
          sql<{ found: number }>`
            SELECT 1 AS found FROM agent_connections c JOIN session s ON s.id = c.session_id
            WHERE c.user_id = ${userId} AND c.client_id = ${clientId} AND s."expiresAt" > now()
            LIMIT 1
          `.pipe(
            Effect.map((rows) => rows.length > 0),
            Effect.orDie,
          ),

        tokenForApp: Effect.fn("AgentConnections.tokenForApp")(function* (connection, app) {
          const principal = yield* principalOf(connection)
          if (Option.isNone(principal) || principal.value.user === null) {
            return yield* new Unauthorized({ message: "The connection was revoked or its session ended" })
          }
          // At most a write a minute per connection, however many calls it makes.
          yield* sql`
            UPDATE agent_connections SET last_used_at = now()
            WHERE id = ${connection} AND last_used_at < now() - interval '1 minute'
          `.pipe(Effect.orDie)
          return yield* keys.sign({ user: principal.value.user, grants: scopeGrants(principal.value.grants, app) }, app)
        }),
      })
    }),
  )
}
