import { Principal } from "@mosaik/core"
import { Schema } from "effect"
import { HttpApi, HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/http-api"

export class AuthProviders extends Schema.Class<AuthProviders>("@mosaik/auth/AuthProviders")({
  password: Schema.Boolean,
  microsoft: Schema.Boolean,
}) {}

export class SessionInfo extends Schema.Class<SessionInfo>("@mosaik/auth/SessionInfo")({
  principal: Principal,
  providers: AuthProviders,
}) {}

/**
 * Browser-facing identity endpoints, served by the auth service next to Better Auth
 * (`/api/auth/*`). Authenticated by the session cookie, not by internal tokens.
 */
export class IdentityGroup extends HttpApiGroup.make("identity").add(
  HttpApiEndpoint.get("session", "/session", { success: SessionInfo }),
  /**
   * Server-Sent Events of `AccessChange`s that may concern the caller: theirs, and the ones
   * for everyone. The browser then loads its session again.
   */
  HttpApiEndpoint.get("live", "/live", {
    success: Schema.String.pipe(HttpApiSchema.asText({ contentType: "text/event-stream" })),
  }),
) {}

export const IDENTITY_LIVE_PATH = "/api/auth/identity/live"

export class IdentityApi extends HttpApi.make("identity").add(IdentityGroup).prefix("/api/auth/identity") {}
