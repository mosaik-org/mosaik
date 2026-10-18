import { Schema } from "effect"

/**
 * Sign-in for standalone apps (on their own address, without the Portal): OAuth 2.0 with
 * the authorization code grant, a deliberate subset of OpenID Connect for Mosaik's SDKs.
 * The client is the app's backend: its id is the app id, its secret the app key.
 */
export const OAUTH_AUTHORIZE_PATH = "/api/auth/oauth/authorize"
export const OAUTH_TOKEN_PATH = "/api/auth/oauth/token"
export const OAUTH_REVOKE_PATH = "/api/auth/oauth/revoke"
/** Core's own sign-in page, where authorizing sends people who are not signed in. */
export const OAUTH_SIGN_IN_PATH = "/api/auth/oauth/sign-in"

/**
 * The token endpoint's answer (RFC 6749 §5.1). The access token is the kind the gateway
 * issues (the user and their grants in this app, `aud` = the app); the refresh token lasts
 * as long as the user's Core session.
 */
export const OAuthTokens = Schema.Struct({
  access_token: Schema.String,
  token_type: Schema.Literal("Bearer"),
  expires_in: Schema.Number,
  refresh_token: Schema.String,
})
export type OAuthTokens = typeof OAuthTokens.Type
