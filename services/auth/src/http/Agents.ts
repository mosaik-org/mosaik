import {
  AGENT_AUTHORIZE_PATH,
  AGENT_REGISTER_PATH,
  AGENT_RESOURCE_PATH,
  AGENT_REVOKE_PATH,
  AGENT_TOKEN_PATH,
  AUTHORIZATION_SERVER_METADATA_PATH,
  signInUrl,
} from "@mosaik/auth/contract"
import { CorePages, escapeHtml, formOf } from "@mosaik/server"
import { Effect, Option } from "effect"
import { HttpRouter, type HttpServerRequest, HttpServerResponse } from "effect/http"
import { AuthConfig } from "../AuthConfig"
import { type AgentClient, AgentClients, matchesRedirect } from "../agents/AgentClients"
import { AgentConnections } from "../agents/AgentConnections"
import { BetterAuth } from "../BetterAuth"
import { oauthError, oauthJson } from "./oauthResponses"

/** AI clients call these endpoints from anywhere, without cookies: any origin may. */
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type, authorization, mcp-protocol-version",
}

/** The parameters of an authorization request (RFC 6749 §4.1.1, RFC 7636, RFC 8707). */
const AUTHORIZE_PARAMS = [
  "response_type",
  "client_id",
  "redirect_uri",
  "state",
  "code_challenge",
  "code_challenge_method",
  "resource",
  "scope",
] as const

/** Answers to the client: back to its redirect URI, with the result and the issuer (RFC 9207). */
const back = (redirectUri: string, issuer: string, params: Record<string, string | null>) => {
  const target = new URL(redirectUri)
  for (const [key, value] of Object.entries({ ...params, iss: issuer })) {
    if (value !== null) target.searchParams.set(key, value)
  }
  return HttpServerResponse.redirect(target, { status: 303, headers: { "cache-control": "no-store" } })
}

/** Canonical form of a resource URI, so `https://core/mcp` and `https://core/mcp/` are the same. */
const canonical = (uri: string) => (URL.canParse(uri) ? new URL(uri).href.replace(/\/$/, "") : uri)

/**
 * Core's sign-in for AI clients, as the OAuth authorization server of Mosaik's MCP server
 * (see `@mosaik/auth/contract`'s agent paths):
 *
 * - the metadata (RFC 8414) clients discover the endpoints with;
 * - `register`: dynamic client registration (RFC 7591), for clients without a client ID
 *   metadata document;
 * - `authorize`: sends people to Core's sign-in if needed, asks them once per client whether to
 *   allow it, and returns to the client with a one-time code;
 * - `token`: the code (with its PKCE verifier) or a refresh token for an access token;
 * - `revoke`: ends a connection (RFC 7009).
 */
export const AgentRoutes = HttpRouter.use(
  Effect.fn(function* (router) {
    const auth = yield* BetterAuth
    const clients = yield* AgentClients
    const connections = yield* AgentConnections
    const pages = yield* CorePages
    const config = yield* AuthConfig
    const issuer = new URL(config.publicUrl).origin
    const resource = canonical(new URL(AGENT_RESOURCE_PATH, config.publicUrl).href)
    const brand = pages.branding.name

    const problem = (message: string) =>
      pages.page({
        title: "Cannot connect",
        body: `<h1>Cannot connect</h1><p class="error">${escapeHtml(message)}</p>`,
        status: 400,
      })

    const consentPage = (params: URLSearchParams, client: AgentClient, email: string, redirectUri: string) => {
      const name = escapeHtml(client.name)
      const identity = Option.match(client.domain, {
        onSome: (domain) => `published by <strong>${escapeHtml(domain)}</strong>`,
        onNone: () => "registered by the client itself: its name is not verified",
      })
      const hidden = AUTHORIZE_PARAMS.filter((key) => params.has(key))
        .map((key) => `<input type="hidden" name="${key}" value="${escapeHtml(params.get(key) ?? "")}">`)
        .join("\n")
      return pages
        .page({
          title: `Allow ${client.name}`,
          body: `<h1>Allow ${name} to use ${escapeHtml(brand)}?</h1>
<p>${name} (${identity}) will be able to do everything you can do in ${escapeHtml(brand)}'s apps, as you: see and change their data, with your permissions. What it does is recorded in the audit log as yours.</p>
<p class="hint">Signed in as ${escapeHtml(email)}. It keeps access until you sign out of ${escapeHtml(brand)} or disconnect it. After you allow it, you return to ${escapeHtml(new URL(redirectUri).host || redirectUri)}.</p>
<form method="post" action="${AGENT_AUTHORIZE_PATH}">
${hidden}
<button type="submit" name="decision" value="allow">Allow</button>
<button type="submit" name="decision" value="deny" class="secondary">Deny</button>
</form>`,
        })
        .pipe(
          // Never inside another site's frame, where someone could be tricked into clicking Allow.
          HttpServerResponse.setHeader("x-frame-options", "DENY"),
          HttpServerResponse.setHeader("content-security-policy", "frame-ancestors 'none'"),
        )
    }

    /**
     * An authorization request, from the query (GET) or the consent form (POST). Problems with
     * the client or its redirect URI show a page: sending anything to an unverified address
     * could hand it to an attacker. Other problems go back to the client.
     */
    const authorize = Effect.fn("Agents.authorize")(function* (
      request: HttpServerRequest.HttpServerRequest,
      params: URLSearchParams,
      decision: "ask" | "allow" | "deny",
    ) {
      const clientId = params.get("client_id") ?? ""
      const redirectUri = params.get("redirect_uri") ?? ""
      const client = yield* clients.find(clientId)
      if (Option.isNone(client)) return problem(`"${clientId.slice(0, 200)}" is not an AI client ${brand} knows.`)
      if (!matchesRedirect(redirectUri, client.value.redirectUris)) {
        return problem(`${client.value.name} asked to return to an address it did not register.`)
      }
      const state = params.get("state")
      const fail = (error: string, description: string) =>
        back(redirectUri, issuer, { error, error_description: description, state })
      if (params.get("response_type") !== "code") {
        return fail("unsupported_response_type", "Only the authorization code flow is supported")
      }
      const codeChallenge = params.get("code_challenge") ?? ""
      if (codeChallenge === "" || params.get("code_challenge_method") !== "S256") {
        return fail("invalid_request", "PKCE with S256 is required")
      }
      const requested = params.get("resource")
      if (requested !== null && canonical(requested) !== resource) {
        return fail("invalid_target", `The only resource is ${resource}`)
      }

      const session = yield* auth.getSession(new Headers(request.headers)).pipe(Effect.orDie)
      if (Option.isNone(session)) {
        const query = new URLSearchParams()
        for (const key of AUTHORIZE_PARAMS) if (params.has(key)) query.set(key, params.get(key) ?? "")
        return HttpServerResponse.redirect(signInUrl(`${AGENT_AUTHORIZE_PATH}?${query}`), {
          headers: { "cache-control": "no-store" },
        })
      }
      if (decision === "deny") return fail("access_denied", "The person did not allow it")
      if (decision === "ask" && !(yield* connections.allowed(session.value.user.id, client.value.id))) {
        return consentPage(params, client.value, session.value.user.email, redirectUri)
      }
      yield* clients.markUsed(client.value.id)
      const code = yield* connections.issueCode({
        client: client.value,
        sessionId: session.value.id,
        redirectUri,
        codeChallenge,
      })
      return back(redirectUri, issuer, { code, state })
    })

    yield* router.add(
      "GET",
      AUTHORIZATION_SERVER_METADATA_PATH,
      Effect.succeed(
        HttpServerResponse.jsonUnsafe(
          {
            issuer,
            authorization_endpoint: `${issuer}${AGENT_AUTHORIZE_PATH}`,
            token_endpoint: `${issuer}${AGENT_TOKEN_PATH}`,
            registration_endpoint: `${issuer}${AGENT_REGISTER_PATH}`,
            revocation_endpoint: `${issuer}${AGENT_REVOKE_PATH}`,
            response_types_supported: ["code"],
            grant_types_supported: ["authorization_code", "refresh_token"],
            code_challenge_methods_supported: ["S256"],
            token_endpoint_auth_methods_supported: ["none"],
            revocation_endpoint_auth_methods_supported: ["none"],
            client_id_metadata_document_supported: true,
            authorization_response_iss_parameter_supported: true,
          },
          { headers: { "cache-control": "public, max-age=300", ...CORS } },
        ),
      ),
    )

    // Preflight for clients running in a browser.
    for (const path of [AGENT_REGISTER_PATH, AGENT_TOKEN_PATH, AGENT_REVOKE_PATH] as const) {
      yield* router.add("OPTIONS", path, Effect.succeed(HttpServerResponse.empty({ status: 204, headers: CORS })))
    }

    yield* router.add(
      "POST",
      AGENT_REGISTER_PATH,
      Effect.fn("Agents.register")(function* (request: HttpServerRequest.HttpServerRequest) {
        const body = yield* request.json.pipe(Effect.option)
        if (Option.isNone(body)) return oauthError("invalid_client_metadata", "Expected a JSON body", 400, CORS)
        return yield* clients.register(body.value).pipe(
          Effect.map((client) =>
            oauthJson(
              {
                client_id: client.id,
                client_id_issued_at: Math.floor(Date.now() / 1000),
                client_name: client.name,
                redirect_uris: client.redirectUris,
                grant_types: ["authorization_code", "refresh_token"],
                response_types: ["code"],
                token_endpoint_auth_method: "none",
              },
              201,
              CORS,
            ),
          ),
          Effect.catchTag("InvalidClientMetadata", (error) =>
            Effect.succeed(oauthError(error.error, error.description, 400, CORS)),
          ),
        )
      }),
    )

    yield* router.add(
      "GET",
      AGENT_AUTHORIZE_PATH,
      Effect.fn(function* (request: HttpServerRequest.HttpServerRequest) {
        return yield* authorize(request, new URL(request.url, issuer).searchParams, "ask")
      }),
    )

    yield* router.add(
      "POST",
      AGENT_AUTHORIZE_PATH,
      Effect.fn(function* (request: HttpServerRequest.HttpServerRequest) {
        // Only Core's own consent page decides (the session cookie is SameSite too).
        const origin = request.headers.origin
        if (origin !== undefined && origin !== issuer) return problem("This form was sent from another site.")
        const params = yield* formOf(request)
        return yield* authorize(request, params, params.get("decision") === "allow" ? "allow" : "deny")
      }),
    )

    yield* router.add(
      "POST",
      AGENT_TOKEN_PATH,
      Effect.fn("Agents.token")(function* (request: HttpServerRequest.HttpServerRequest) {
        const params = yield* formOf(request)
        const clientId = params.get("client_id")
        if (clientId === null) return oauthError("invalid_client", "client_id is required", 401, CORS)
        const requested = params.get("resource")
        if (requested !== null && canonical(requested) !== resource) {
          return oauthError("invalid_target", `The only resource is ${resource}`, 400, CORS)
        }
        const grant = params.get("grant_type")
        const result =
          grant === "authorization_code"
            ? connections.exchangeCode({
                clientId,
                code: params.get("code") ?? "",
                redirectUri: params.get("redirect_uri") ?? "",
                codeVerifier: params.get("code_verifier") ?? "",
              })
            : grant === "refresh_token"
              ? connections.refresh(clientId, params.get("refresh_token") ?? "")
              : undefined
        if (result === undefined) {
          return oauthError("unsupported_grant_type", "Use authorization_code or refresh_token", 400, CORS)
        }
        return yield* result.pipe(
          Effect.map((tokens) => oauthJson(tokens, 200, CORS)),
          Effect.catchTag("InvalidGrant", (error) =>
            Effect.succeed(oauthError("invalid_grant", error.reason, 400, CORS)),
          ),
        )
      }),
    )

    yield* router.add(
      "POST",
      AGENT_REVOKE_PATH,
      Effect.fn("Agents.revoke")(function* (request: HttpServerRequest.HttpServerRequest) {
        const params = yield* formOf(request)
        // Unknown tokens are not an error (RFC 7009 §2.2); access tokens expire on their own.
        yield* connections.revokeToken(params.get("client_id") ?? "", params.get("token") ?? "")
        return HttpServerResponse.empty({ status: 200, headers: CORS })
      }),
    )
  }),
)
