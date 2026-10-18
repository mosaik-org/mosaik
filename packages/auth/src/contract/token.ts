import { Principal, PrincipalUser } from "@mosaik/core"
import { Schema } from "effect"

/**
 * Issuer of the internal tokens the gateway attaches to API requests. Each token's
 * audience is the one service (app or platform service) it is meant for, so a token
 * cannot be replayed against another app.
 */
export const TOKEN_ISSUER = "mosaik-auth"
export const TOKEN_ALGORITHM = "EdDSA"
export const TOKEN_TTL_SECONDS = 60
export const JWKS_PATH = "/.well-known/jwks.json"

/** Better Auth cookie prefix; the session cookie identifies a principal in the gateway cache. */
export const COOKIE_PREFIX = "mosaik"
export const SESSION_COOKIE_NAMES = [`${COOKIE_PREFIX}.session_token`, `__Secure-${COOKIE_PREFIX}.session_token`]

/** Custom JWT claims. Registered claims (iss, aud, exp, ...) are validated by `jose`. */
export const TokenClaims = Schema.Struct({
  user: Schema.NullOr(PrincipalUser),
  grants: Principal.fields.grants,
})
export type TokenClaims = typeof TokenClaims.Type
