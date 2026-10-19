import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto"
import { join, normalize, resolve, sep } from "node:path"
import {
  AuthProviders,
  OAUTH_AUTHORIZE_PATH,
  OAUTH_REVOKE_PATH,
  OAUTH_TOKEN_PATH,
  OAuthTokens,
  SessionInfo,
  STANDALONE_PATHS,
} from "@mosaik/auth/contract"
import { TokenVerifier } from "@mosaik/auth/server"
import { type AnyApp, Principal } from "@mosaik/core"
import { NOTIFICATION_SETTINGS_PAGE } from "@mosaik/notifications/contract"
import { requestAccessUrl } from "@mosaik/platform/contract"
import { appKey } from "@mosaik/platform/server"
import { Config, Effect, Layer, Option, Redacted, Schema } from "effect"
import { Cookies, Headers, HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/http"
import { localPath } from "./Pages"

const {
  signIn: SIGN_IN_PATH,
  callback: CALLBACK_PATH,
  signOut: SIGN_OUT_PATH,
  session: SESSION_PATH,
} = STANDALONE_PATHS

/** Refresh a little before the access token expires, so the API never sees an expired one. */
const EXPIRY_MARGIN_MS = 10_000
const SIGN_IN_TTL_SECONDS = 600

/** What the session cookie holds: the tokens, never shown to the page. */
const Session = Schema.Struct({ access: Schema.String, refresh: Schema.String, expiresAt: Schema.Number })
type Session = typeof Session.Type
const SignIn = Schema.Struct({ state: Schema.String, return: Schema.String })

const decodeTokens = Schema.decodeUnknownEffect(OAuthTokens)

/** AES-256-GCM with a key derived from the app key: only this app's backend can read its cookies. */
const makeSealer = (key: Redacted.Redacted<string>) => {
  const secret = Buffer.from(hkdfSync("sha256", Redacted.value(key), "mosaik-app", "session-cookie", 32))
  return {
    seal: (value: unknown): string => {
      const iv = randomBytes(12)
      const cipher = createCipheriv("aes-256-gcm", secret, iv)
      const data = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()])
      return [iv, cipher.getAuthTag(), data].map((part) => part.toString("base64url")).join(".")
    },
    open: (sealed: string | undefined): unknown => {
      const [iv, tag, data] = (sealed ?? "").split(".")
      if (iv === undefined || tag === undefined || data === undefined) return undefined
      try {
        const decipher = createDecipheriv("aes-256-gcm", secret, Buffer.from(iv, "base64url"))
        decipher.setAuthTag(Buffer.from(tag, "base64url"))
        return JSON.parse(
          Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8"),
        )
      } catch {
        return undefined
      }
    },
  }
}

/**
 * Standalone mode: the app serves its own page on its own address (`MOSAIK_PUBLIC_URL`) and
 * signs people in through Core (`MOSAIK_URL`), instead of being mounted in the Portal behind
 * the gateway. The backend plays the gateway's part:
 *
 * - `/auth/sign-in`, `/auth/callback`, `/auth/sign-out`: OAuth with Core; the tokens stay in an
 *   encrypted, HTTP-only cookie on the app's domain and never reach the page.
 * - `/auth/request-access`, `/auth/notification-settings`: on to Core's pages (and back), so
 *   the page needs no address but its own (`STANDALONE_PATHS`).
 * - Every request: the cookie becomes `Authorization: Bearer <token>`, refreshed before it
 *   expires, so `AccessControl` and `RequiredPermission` work as they do behind the gateway.
 * - `/api/auth/identity/session`: who is signed in, for the page.
 * - Everything else: the page (`MOSAIK_WEB_DIR`, built by `mosaikApp({ standalone: true })`).
 *
 * People who are not signed in get no token: the app's API answers 401 and the page offers to
 * sign in.
 */
export const standaloneRoutes = (app: AnyApp) =>
  Layer.unwrap(
    Effect.gen(function* () {
      const publicUrl = new URL(yield* Config.String("MOSAIK_PUBLIC_URL"))
      const coreUrl = yield* Config.URL("MOSAIK_URL")
      const webDir = resolve(yield* Config.String("MOSAIK_WEB_DIR").pipe(Config.withDefault("dist/web")))
      const key = yield* appKey(app.id)
      const verifier = yield* TokenVerifier
      const sealer = makeSealer(key)
      const secure = publicUrl.protocol === "https:"
      const sessionCookie = `mosaik_${app.id}_session`
      const signInCookie = `mosaik_${app.id}_sign_in`
      const redirectUri = new URL(CALLBACK_PATH, publicUrl).toString()
      const cookieOptions = { httpOnly: true, secure, sameSite: "lax", path: "/" } as const

      /** Calls Core's token or revoke endpoint as this app (the app key is the client secret). */
      const post = (path: string, params: Record<string, string>) =>
        Effect.tryPromise({
          try: () =>
            fetch(new URL(path, coreUrl), {
              method: "POST",
              headers: { "content-type": "application/x-www-form-urlencoded" },
              body: new URLSearchParams({ client_id: app.id, client_secret: Redacted.value(key), ...params }),
              signal: AbortSignal.timeout(10_000),
            }),
          catch: (cause) => new Error(`Core is not reachable: ${String(cause)}`),
        })

      const requestTokens = (params: Record<string, string>) =>
        post(OAUTH_TOKEN_PATH, params).pipe(
          Effect.flatMap((response) =>
            response.ok
              ? Effect.promise(() => response.json() as Promise<unknown>)
              : Effect.fail(new Error(`Core refused: HTTP ${response.status}`)),
          ),
          Effect.flatMap(decodeTokens),
          Effect.map(
            (tokens): Session => ({
              access: tokens.access_token,
              refresh: tokens.refresh_token,
              expiresAt: Date.now() + tokens.expires_in * 1000,
            }),
          ),
        )

      const readSession = (request: HttpServerRequest.HttpServerRequest) =>
        Schema.decodeUnknownOption(Session)(sealer.open(request.cookies[sessionCookie]))

      const withSession = (response: HttpServerResponse.HttpServerResponse, session: Option.Option<Session>) =>
        (Option.isSome(session)
          ? HttpServerResponse.setCookie(response, sessionCookie, sealer.seal(session.value), cookieOptions)
          : HttpServerResponse.expireCookie(response, sessionCookie, cookieOptions)
        ).pipe(Effect.orDie)

      /** The cookie, as a bearer token for the routes; a refreshed or ended session updates the cookie. */
      const Bearer = HttpRouter.middleware(
        (httpEffect) =>
          Effect.gen(function* () {
            const request = yield* HttpServerRequest.HttpServerRequest
            const current = readSession(request)
            if (Option.isNone(current)) return yield* httpEffect
            const fresh = current.value.expiresAt - Date.now() > EXPIRY_MARGIN_MS
            const session = fresh
              ? current
              : yield* requestTokens({ grant_type: "refresh_token", refresh_token: current.value.refresh }).pipe(
                  Effect.map(Option.some),
                  // The Core session ended (signed out, expired) or the user was removed: signed out here too.
                  Effect.catch((error) =>
                    Effect.logInfo("Session ended", { reason: error.message }).pipe(Effect.as(Option.none<Session>())),
                  ),
                )
            const forwarded = Option.match(session, {
              onNone: () => request.modify({ headers: Headers.remove(request.headers, "authorization") }),
              onSome: ({ access }) =>
                request.modify({ headers: Headers.set(request.headers, "authorization", `Bearer ${access}`) }),
            })
            const response = yield* Effect.provideService(httpEffect, HttpServerRequest.HttpServerRequest, forwarded)
            // A route that set the cookie itself (signing out) has the last word.
            const routeSetIt = Option.isSome(Cookies.get(response.cookies, sessionCookie))
            return fresh || routeSetIt ? response : yield* withSession(response, session)
          }),
        { global: true },
      )

      const signIn = HttpRouter.add(
        "GET",
        SIGN_IN_PATH,
        Effect.gen(function* () {
          const request = yield* HttpServerRequest.HttpServerRequest
          const back = localPath(new URL(request.url, publicUrl).searchParams.get("return"))
          const state = randomBytes(16).toString("base64url")
          const authorize = new URL(OAUTH_AUTHORIZE_PATH, coreUrl)
          authorize.search = new URLSearchParams({
            response_type: "code",
            client_id: app.id,
            redirect_uri: redirectUri,
            state,
          }).toString()
          return yield* HttpServerResponse.redirect(authorize).pipe(
            HttpServerResponse.setCookie(signInCookie, sealer.seal({ state, return: back }), {
              ...cookieOptions,
              maxAge: `${SIGN_IN_TTL_SECONDS} seconds`,
            }),
            Effect.orDie,
          )
        }),
      )

      const callback = HttpRouter.add(
        "GET",
        CALLBACK_PATH,
        Effect.gen(function* () {
          const request = yield* HttpServerRequest.HttpServerRequest
          const query = new URL(request.url, publicUrl).searchParams
          const pending = Schema.decodeUnknownOption(SignIn)(sealer.open(request.cookies[signInCookie]))
          const code = query.get("code")
          // The state ties the answer to a sign-in this browser started.
          if (Option.isNone(pending) || code === null || query.get("state") !== pending.value.state) {
            return HttpServerResponse.text("This sign-in expired or was started elsewhere. Try again.", { status: 400 })
          }
          const session = yield* requestTokens({
            grant_type: "authorization_code",
            code,
            redirect_uri: redirectUri,
          }).pipe(Effect.option)
          if (Option.isNone(session)) {
            return HttpServerResponse.text("Signing in failed. Try again.", { status: 502 })
          }
          return yield* withSession(HttpServerResponse.redirect(pending.value.return), session).pipe(
            Effect.flatMap(HttpServerResponse.expireCookie(signInCookie, cookieOptions)),
            Effect.orDie,
          )
        }),
      )

      const signOut = HttpRouter.add(
        "POST",
        SIGN_OUT_PATH,
        Effect.gen(function* () {
          const request = yield* HttpServerRequest.HttpServerRequest
          const session = readSession(request)
          if (Option.isSome(session)) {
            yield* post(OAUTH_REVOKE_PATH, { token: session.value.refresh }).pipe(Effect.ignore)
          }
          return yield* withSession(HttpServerResponse.redirect("/", { status: 303 }), Option.none())
        }),
      )

      const sessionInfo = HttpRouter.add(
        "GET",
        SESSION_PATH,
        Effect.gen(function* () {
          const request = yield* HttpServerRequest.HttpServerRequest
          const token = Option.getOrUndefined(Headers.get(request.headers, "authorization"))?.replace(/^Bearer /, "")
          const principal =
            token === undefined
              ? new Principal({ user: null, grants: [] })
              : yield* verifier
                  .verify(token)
                  .pipe(Effect.orElseSucceed(() => new Principal({ user: null, grants: [] })))
          const info = new SessionInfo({
            principal,
            providers: new AuthProviders({ password: true, microsoft: false }),
          })
          return HttpServerResponse.jsonUnsafe(Schema.encodeSync(SessionInfo)(info), {
            headers: { "cache-control": "no-store" },
          })
        }),
      )

      /** The page and its assets; any other path is the page too (client-side routes). */
      const page = HttpRouter.add(
        "GET",
        "/*",
        Effect.gen(function* () {
          const request = yield* HttpServerRequest.HttpServerRequest
          const path = decodeURIComponent(new URL(request.url, publicUrl).pathname)
          if (path.startsWith("/api/") || path.startsWith("/auth/")) return HttpServerResponse.empty({ status: 404 })
          const target = normalize(join(webDir, path))
          const file = target.startsWith(webDir + sep) ? Bun.file(target) : undefined
          if (file !== undefined && (yield* Effect.promise(() => file.exists()))) {
            return HttpServerResponse.fromWeb(
              new Response(file, {
                headers: {
                  "content-type": file.type,
                  // Built assets are content-hashed; everything else is looked at again.
                  "cache-control": path.startsWith("/assets/") ? "public, max-age=31536000, immutable" : "no-cache",
                },
              }),
            )
          }
          const index = Bun.file(join(webDir, "index.html"))
          if (!(yield* Effect.promise(() => index.exists()))) {
            return HttpServerResponse.text("The page is not built yet (bun run build).", { status: 404 })
          }
          return HttpServerResponse.fromWeb(
            new Response(index, {
              headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-cache" },
            }),
          )
        }),
      )

      /** On to Core's page for asking for access to this app; it links back to `return` on this app. */
      const requestAccess = HttpRouter.add(
        "GET",
        STANDALONE_PATHS.requestAccess,
        Effect.gen(function* () {
          const request = yield* HttpServerRequest.HttpServerRequest
          const back = new URL(localPath(new URL(request.url, publicUrl).searchParams.get("return")), publicUrl)
          return HttpServerResponse.redirect(new URL(requestAccessUrl(app.id, back.toString()), coreUrl))
        }),
      )

      const notificationSettings = HttpRouter.add(
        "GET",
        STANDALONE_PATHS.notificationSettings,
        Effect.succeed(HttpServerResponse.redirect(new URL(NOTIFICATION_SETTINGS_PAGE, coreUrl))),
      )

      yield* Effect.logInfo("Standalone", { publicUrl: publicUrl.toString(), core: coreUrl.toString() })
      return Layer.mergeAll(Bearer, signIn, callback, signOut, sessionInfo, requestAccess, notificationSettings, page)
    }),
  )
