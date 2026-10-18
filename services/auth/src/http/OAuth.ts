import { OAUTH_AUTHORIZE_PATH, OAUTH_REVOKE_PATH, OAUTH_SIGN_IN_PATH, OAUTH_TOKEN_PATH } from "@mosaik/auth/contract"
import { Effect, Option } from "effect"
import { HttpRouter, type HttpServerRequest, HttpServerResponse } from "effect/http"
import { BetterAuth } from "../BetterAuth"
import { OAuth } from "../OAuth"
import { PlatformClient } from "../PlatformClient"

/** Whether `uri` is the app's address or below it (same origin, path under the base path). */
export const isUnder = (uri: string, base: string): boolean => {
  if (!URL.canParse(uri) || !URL.canParse(base)) return false
  const target = new URL(uri)
  const root = new URL(base)
  const path = root.pathname.endsWith("/") ? root.pathname : `${root.pathname}/`
  return target.origin === root.origin && `${target.pathname}/`.startsWith(path) && target.username === ""
}

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`)

const page = (title: string, body: string, status = 200) =>
  HttpServerResponse.html(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} · Mosaik</title>
<style>
  :root { color-scheme: light dark; font-family: system-ui, sans-serif; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: Canvas; }
  main { width: min(22rem, calc(100vw - 2rem)); display: grid; gap: 1rem; }
  h1 { font-size: 1.25rem; margin: 0; }
  form { display: grid; gap: 0.75rem; }
  label { display: grid; gap: 0.25rem; font-size: 0.875rem; }
  input { font: inherit; padding: 0.5rem; border: 1px solid GrayText; border-radius: 0.375rem; }
  button { font: inherit; padding: 0.5rem; border: 0; border-radius: 0.375rem; background: #2563eb; color: white; cursor: pointer; }
  .error { color: #dc2626; margin: 0; }
  .hint { color: GrayText; font-size: 0.875rem; margin: 0; }
</style>
</head>
<body><main>${body}</main></body>
</html>`).pipe(HttpServerResponse.setStatus(status), HttpServerResponse.setHeader("cache-control", "no-store"))

const problem = (message: string) =>
  page("Cannot sign in", `<h1>Cannot sign in</h1><p class="error">${escapeHtml(message)}</p>`, 400)

/** Only authorize requests: sign-in never sends anyone elsewhere. */
const safeReturn = (value: string | null) =>
  value !== null && value.startsWith(`${OAUTH_AUTHORIZE_PATH}?`) ? value : null

const requestUrl = (request: HttpServerRequest.HttpServerRequest) => new URL(request.url, "http://core")

const form = (request: HttpServerRequest.HttpServerRequest) =>
  request.text.pipe(
    Effect.map((text) => new URLSearchParams(text)),
    Effect.orElseSucceed(() => new URLSearchParams()),
  )

const json = (body: unknown, status = 200) =>
  HttpServerResponse.jsonUnsafe(body, { status, headers: { "cache-control": "no-store" } })

/** An OAuth error (RFC 6749 §5.2). */
const oauthError = (error: string, description: string, status = 400) =>
  json({ error, error_description: description }, status)

/**
 * Core's sign-in for standalone apps (OAuth 2.0 authorization code, see `@mosaik/auth/contract`).
 *
 * - `authorize`: the app's backend sends the browser here; someone not signed in to Core goes
 *   to the sign-in page first. The browser returns to the app with a one-time code, only to
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
        const url = requestUrl(request)
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
        if (Option.isNone(session)) {
          const back = `${OAUTH_AUTHORIZE_PATH}${url.search}`
          return HttpServerResponse.redirect(`${OAUTH_SIGN_IN_PATH}?${new URLSearchParams({ return: back })}`)
        }
        const code = yield* oauth.issueCode(app.value.id, session.value.id, redirectUri)
        const target = new URL(redirectUri)
        target.searchParams.set("code", code)
        const state = query.get("state")
        if (state !== null) target.searchParams.set("state", state)
        return HttpServerResponse.redirect(target, { headers: { "cache-control": "no-store" } })
      }),
    )

    yield* router.add("GET", OAUTH_SIGN_IN_PATH, (request: HttpServerRequest.HttpServerRequest) =>
      Effect.sync(() => {
        const query = requestUrl(request).searchParams
        const back = safeReturn(query.get("return"))
        if (back === null) return problem("Sign in from the app you want to use.")
        const error = query.has("failed") ? `<p class="error">Wrong e-mail or password.</p>` : ""
        return page(
          "Sign in",
          `<h1>Sign in to Mosaik</h1>
<p class="hint">to continue to the app</p>
${error}
<form method="post" action="${OAUTH_SIGN_IN_PATH}">
  <input type="hidden" name="return" value="${escapeHtml(back)}">
  <label>E-mail <input name="email" type="email" autocomplete="username" required autofocus></label>
  <label>Password <input name="password" type="password" autocomplete="current-password" required></label>
  <button type="submit">Sign in</button>
</form>`,
        )
      }),
    )

    yield* router.add(
      "POST",
      OAUTH_SIGN_IN_PATH,
      Effect.fn("OAuth.signIn")(function* (request: HttpServerRequest.HttpServerRequest) {
        const params = yield* form(request)
        const back = safeReturn(params.get("return"))
        if (back === null) return problem("Sign in from the app you want to use.")
        const signedIn = yield* auth
          .signInWithPassword(params.get("email") ?? "", params.get("password") ?? "", new Headers(request.headers))
          .pipe(Effect.option)
        if (Option.isNone(signedIn) || !signedIn.value.ok) {
          return HttpServerResponse.redirect(
            `${OAUTH_SIGN_IN_PATH}?${new URLSearchParams({ return: back, failed: "1" })}`,
            {
              status: 303,
            },
          )
        }
        // Back to authorizing, now with the session cookie Better Auth set.
        const headers = new Headers({ location: back, "cache-control": "no-store" })
        for (const cookie of signedIn.value.headers.getSetCookie()) headers.append("set-cookie", cookie)
        return HttpServerResponse.fromWeb(new Response(null, { status: 303, headers }))
      }),
    )

    yield* router.add(
      "POST",
      OAUTH_TOKEN_PATH,
      Effect.fn("OAuth.token")(function* (request: HttpServerRequest.HttpServerRequest) {
        const params = yield* form(request)
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
          Effect.map((tokens) => json(tokens)),
          Effect.catchTag("InvalidGrant", (error) => Effect.succeed(oauthError("invalid_grant", error.reason))),
        )
      }),
    )

    yield* router.add(
      "POST",
      OAUTH_REVOKE_PATH,
      Effect.fn("OAuth.revoke")(function* (request: HttpServerRequest.HttpServerRequest) {
        const params = yield* form(request)
        const appId = yield* authenticate(params)
        if (Option.isNone(appId)) return oauthError("invalid_client", "Unknown app or wrong app key", 401)
        yield* oauth.revoke(appId.value, params.get("token") ?? "")
        return HttpServerResponse.empty({ status: 200 })
      }),
    )
  }),
)
