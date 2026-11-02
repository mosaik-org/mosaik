import { OAUTH_AUTHORIZE_PATH, OAUTH_REVOKE_PATH, OAUTH_TOKEN_PATH, signInUrl } from "@mosaik/auth/contract"
import { CorePages, escapeHtml, formOf, isUnder } from "@mosaik/server"
import { Effect, Option } from "effect"
import { HttpRouter, type HttpServerRequest, HttpServerResponse } from "effect/http"
import { BetterAuth } from "../BetterAuth"
import { OAuth } from "../OAuth"
import { PlatformClient } from "../PlatformClient"
import { oauthError, oauthJson } from "./oauthResponses"

/**
 * Core's sign-in for standalone apps (OAuth 2.0 authorization code, see `@mosaik/auth/contract`).
 *
 * - `authorize`: the app's backend sends the browser here; someone not signed in to Core goes
 *   to Core's sign-in page first (see `SignInRoutes`). The browser returns to the app with a one-time code, only to
 *   an address under the one the app registered.
 * - `token`: the app's backend exchanges the code (or a refresh token) for an access token,
 *   authenticated by its app key as the client secret.
 * - `revoke`: the app's backend ends its refresh token when the user signs out of the app.
 */
export const OAuthRoutes = HttpRouter.use(
  Effect.fn(function* (router) {
    const auth = yield* BetterAuth
    const oauth = yield* OAuth
    const platform = yield* PlatformClient
    const pages = yield* CorePages
    const problem = (message: string) =>
      pages.page({
        title: "Cannot sign in",
        body: `<h1>Cannot sign in</h1><p class="error">${escapeHtml(message)}</p>`,
        status: 400,
      })

    const client = (id: string) =>
      platform.clients.get({ params: { id } }).pipe(
        Effect.map(Option.some),
        Effect.catchTag("NotFound", () => Effect.succeed(Option.none())),
        Effect.orDie,
      )

    /** The app whose key this is, if it is the client it says. */
    const authenticate = (params: URLSearchParams) =>
      Effect.gen(function* () {
        const id = params.get("client_id")
        const key = params.get("client_secret")
        if (id === null || key === null) return Option.none<string>()
        const app = yield* platform.clients.authenticate({ payload: { key } }).pipe(
          Effect.map(Option.some),
          Effect.catchTag("Unauthorized", () => Effect.succeed(Option.none())),
          Effect.orDie,
        )
        return Option.filter(
          Option.map(app, (app) => app.id),
          (appId) => appId === id,
        )
      })

    yield* router.add(
      "GET",
      OAUTH_AUTHORIZE_PATH,
      Effect.fn("OAuth.authorize")(function* (request: HttpServerRequest.HttpServerRequest) {
        const url = new URL(request.url, "http://core")
        const query = url.searchParams
        const clientId = query.get("client_id") ?? ""
        const redirectUri = query.get("redirect_uri") ?? ""
        if (query.get("response_type") !== "code") return problem("Only the authorization code flow is supported.")
        const app = yield* client(clientId)
        if (Option.isNone(app) || app.value.publicUrl === null) {
          return problem(`"${clientId}" is not an app that signs people in on its own address.`)
        }
        // Never send a code to an address the app did not register.
        if (!isUnder(redirectUri, app.value.publicUrl)) {
          return problem(`The app asked to return to an address outside ${app.value.publicUrl}.`)
        }
        const session = yield* auth.getSession(new Headers(request.headers)).pipe(Effect.orDie)
        if (Option.isNone(session))
          return HttpServerResponse.redirect(signInUrl(`${OAUTH_AUTHORIZE_PATH}${url.search}`))
        const code = yield* oauth.issueCode(app.value.id, session.value.id, redirectUri)
        const target = new URL(redirectUri)
        target.searchParams.set("code", code)
        const state = query.get("state")
        if (state !== null) target.searchParams.set("state", state)
        return HttpServerResponse.redirect(target, { headers: { "cache-control": "no-store" } })
      }),
    )

    yield* router.add(
      "POST",
      OAUTH_TOKEN_PATH,
      Effect.fn("OAuth.token")(function* (request: HttpServerRequest.HttpServerRequest) {
        const params = yield* formOf(request)
        const appId = yield* authenticate(params)
        if (Option.isNone(appId)) return oauthError("invalid_client", "Unknown app or wrong app key", 401)
        const grant = params.get("grant_type")
        const result =
          grant === "authorization_code"
            ? oauth.exchangeCode(appId.value, params.get("code") ?? "", params.get("redirect_uri") ?? "")
            : grant === "refresh_token"
              ? oauth.refresh(appId.value, params.get("refresh_token") ?? "")
              : undefined
        if (result === undefined) return oauthError("unsupported_grant_type", "Use authorization_code or refresh_token")
        return yield* result.pipe(
          Effect.map((tokens) => oauthJson(tokens)),
          Effect.catchTag("InvalidGrant", (error) => Effect.succeed(oauthError("invalid_grant", error.reason))),
        )
      }),
    )

    yield* router.add(
      "POST",
      OAUTH_REVOKE_PATH,
      Effect.fn("OAuth.revoke")(function* (request: HttpServerRequest.HttpServerRequest) {
        const params = yield* formOf(request)
        const appId = yield* authenticate(params)
        if (Option.isNone(appId)) return oauthError("invalid_client", "Unknown app or wrong app key", 401)
        yield* oauth.revoke(appId.value, params.get("token") ?? "")
        return HttpServerResponse.empty({ status: 200 })
      }),
    )
  }),
)
