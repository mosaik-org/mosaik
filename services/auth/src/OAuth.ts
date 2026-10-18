import { createHash, randomBytes } from "node:crypto"
import { PgClient } from "@effect/sql-pg"
import { type OAuthTokens, TOKEN_TTL_SECONDS } from "@mosaik/auth/contract"
import { scopeGrants, UserId } from "@mosaik/core"
import { Context, Data, Duration, Effect, Layer, Option } from "effect"
import { Access } from "./rbac/Access"
import { Users } from "./rbac/Users"
import { SigningKeys } from "./SigningKeys"

/** How long an authorization code can be exchanged. */
const CODE_TTL = Duration.minutes(1)

/** The code or refresh token is unknown, used, expired, for another app, or its session ended (RFC 6749 `invalid_grant`). */
export class InvalidGrant extends Data.TaggedError("InvalidGrant")<{ readonly reason: string }> {}

const secret = () => randomBytes(32).toString("base64url")
const hash = (value: string) => createHash("sha256").update(value).digest("base64url")

/**
 * Sign-in for standalone apps: one-time codes for a Core session, exchanged for tokens like
 * the gateway's (the user and their grants in the app), and refresh tokens that live as long
 * as that session. Only hashes are stored.
 */
export class OAuth extends Context.Service<
  OAuth,
  {
    /** A code for the app, for whoever is signed in with the session. */
    issueCode(appId: string, sessionId: string, redirectUri: string): Effect.Effect<string>
    /** Tokens for a code, if it is unused and was issued to this app for this redirect. */
    exchangeCode(appId: string, code: string, redirectUri: string): Effect.Effect<OAuthTokens, InvalidGrant>
    /** A new access token while the session lasts; the refresh token stays the same. */
    refresh(appId: string, refreshToken: string): Effect.Effect<OAuthTokens, InvalidGrant>
    revoke(appId: string, refreshToken: string): Effect.Effect<void>
  }
>()("@mosaik/auth-service/OAuth") {
  static readonly layer = Layer.effect(
    OAuth,
    Effect.gen(function* () {
      const sql = yield* PgClient.PgClient
      const keys = yield* SigningKeys
      const access = yield* Access
      const users = yield* Users

      /** The user of a session that has not expired. */
      const sessionUser = Effect.fn(function* (sessionId: string) {
        const [row] = yield* sql<{ userId: string }>`
          SELECT "userId" AS user_id FROM session WHERE id = ${sessionId} AND "expiresAt" > now()
        `.pipe(Effect.orDie)
        if (row === undefined) return Option.none()
        const [user] = yield* users.lookup([UserId.make(row.userId)])
        return Option.fromUndefinedOr(user)
      })

      const accessToken = Effect.fn("OAuth.accessToken")(function* (appId: string, sessionId: string) {
        const user = yield* sessionUser(sessionId)
        if (Option.isNone(user)) return yield* new InvalidGrant({ reason: "The session ended" })
        const principal = yield* access.principalFor(user)
        const issued = yield* keys.sign({ user: principal.user, grants: scopeGrants(principal.grants, appId) }, appId)
        return issued.token
      })

      return OAuth.of({
        issueCode: Effect.fn("OAuth.issueCode")(function* (appId, sessionId, redirectUri) {
          const code = secret()
          const expiresAt = new Date(Date.now() + Duration.toMillis(CODE_TTL))
          yield* sql`
            INSERT INTO oauth_codes ${sql.insert({ codeHash: hash(code), appId, sessionId, redirectUri, expiresAt })}
          `.pipe(Effect.orDie)
          // Expired codes of anyone: they are never exchanged now.
          yield* sql`DELETE FROM oauth_codes WHERE expires_at < now()`.pipe(Effect.orDie)
          return code
        }),

        exchangeCode: Effect.fn("OAuth.exchangeCode")(function* (appId, code, redirectUri) {
          // Deleted as it is read: a code works once, even when two requests race.
          const [row] = yield* sql<{ sessionId: string }>`
            DELETE FROM oauth_codes
            WHERE code_hash = ${hash(code)} AND app_id = ${appId} AND redirect_uri = ${redirectUri} AND expires_at > now()
            RETURNING session_id
          `.pipe(Effect.orDie)
          if (row === undefined) return yield* new InvalidGrant({ reason: "Unknown, used or expired code" })
          const token = yield* accessToken(appId, row.sessionId)
          const refreshToken = secret()
          yield* sql`
            INSERT INTO oauth_refresh_tokens ${sql.insert({ tokenHash: hash(refreshToken), appId, sessionId: row.sessionId })}
          `.pipe(Effect.orDie)
          return {
            access_token: token,
            token_type: "Bearer",
            expires_in: TOKEN_TTL_SECONDS,
            refresh_token: refreshToken,
          } as const
        }),

        refresh: Effect.fn("OAuth.refresh")(function* (appId, refreshToken) {
          const [row] = yield* sql<{ sessionId: string }>`
            UPDATE oauth_refresh_tokens SET last_used_at = now()
            WHERE token_hash = ${hash(refreshToken)} AND app_id = ${appId}
            RETURNING session_id
          `.pipe(Effect.orDie)
          if (row === undefined) return yield* new InvalidGrant({ reason: "Unknown or revoked refresh token" })
          const token = yield* accessToken(appId, row.sessionId)
          return {
            access_token: token,
            token_type: "Bearer",
            expires_in: TOKEN_TTL_SECONDS,
            refresh_token: refreshToken,
          } as const
        }),

        revoke: (appId, refreshToken) =>
          sql`DELETE FROM oauth_refresh_tokens WHERE token_hash = ${hash(refreshToken)} AND app_id = ${appId}`.pipe(
            Effect.asVoid,
            Effect.orDie,
          ),
      })
    }),
  )
}
