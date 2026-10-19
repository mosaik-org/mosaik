import { SIGN_IN_MICROSOFT_PATH, SIGN_IN_PATH } from "@mosaik/auth/contract"
import { CorePages, escapeHtml, formOf, localPath } from "@mosaik/server"
import { Effect, Option } from "effect"
import { HttpRouter, type HttpServerRequest, HttpServerResponse } from "effect/http"
import { BetterAuth } from "../BetterAuth"

const queryOf = (request: HttpServerRequest.HttpServerRequest) => new URL(request.url, "http://core").searchParams

/** A redirect that also sets the cookies Better Auth's answer set (the session, or a sign-in's state). */
const redirectWithCookies = (location: string, from: Response) => {
  const headers = new Headers({ location, "cache-control": "no-store" })
  for (const cookie of from.headers.getSetCookie()) headers.append("set-cookie", cookie)
  return HttpServerResponse.fromWeb(new Response(null, { status: 303, headers }))
}

/**
 * Core's sign-in page, the one way in for the shell, the console and standalone apps (whose
 * OAuth authorize sends people here). Rendered on the server: e-mail and password, and
 * Microsoft through a redirect started here, so it needs no JavaScript. It returns only to
 * paths on Core's origin; someone already signed in goes straight there.
 */
export const SignInRoutes = HttpRouter.use(
  Effect.fn(function* (router) {
    const auth = yield* BetterAuth
    const pages = yield* CorePages

    const signInPage = (back: string, failed: boolean) =>
      pages.page({
        title: "Sign in",
        body: `<h1>Sign in</h1>
${failed ? `<p class="error">That did not work. Check your e-mail and password.</p>` : ""}
<form method="post" action="${SIGN_IN_PATH}">
  <input type="hidden" name="return" value="${escapeHtml(back)}">
  <label>E-mail <input name="email" type="email" autocomplete="username" required autofocus></label>
  <label>Password <input name="password" type="password" autocomplete="current-password" required></label>
  <button type="submit">Sign in</button>
</form>
${
  auth.providers.microsoft
    ? `<a class="button secondary" href="${SIGN_IN_MICROSOFT_PATH}?${escapeHtml(new URLSearchParams({ return: back }).toString())}">Sign in with Microsoft</a>`
    : ""
}`,
      })

    yield* router.add(
      "GET",
      SIGN_IN_PATH,
      Effect.fn("SignIn.page")(function* (request: HttpServerRequest.HttpServerRequest) {
        const query = queryOf(request)
        const back = localPath(query.get("return"))
        const session = yield* auth.getSession(new Headers(request.headers)).pipe(Effect.orDie)
        if (Option.isSome(session))
          return HttpServerResponse.redirect(back, { headers: { "cache-control": "no-store" } })
        return signInPage(back, query.has("failed"))
      }),
    )

    yield* router.add(
      "POST",
      SIGN_IN_PATH,
      Effect.fn("SignIn.password")(function* (request: HttpServerRequest.HttpServerRequest) {
        const params = yield* formOf(request)
        const back = localPath(params.get("return"))
        const signedIn = yield* auth
          .signInWithPassword(params.get("email") ?? "", params.get("password") ?? "", new Headers(request.headers))
          .pipe(Effect.option)
        if (Option.isNone(signedIn) || !signedIn.value.ok) {
          return HttpServerResponse.redirect(`${SIGN_IN_PATH}?${new URLSearchParams({ return: back, failed: "1" })}`, {
            status: 303,
          })
        }
        return redirectWithCookies(back, signedIn.value)
      }),
    )

    yield* router.add(
      "GET",
      SIGN_IN_MICROSOFT_PATH,
      Effect.fn("SignIn.microsoft")(function* (request: HttpServerRequest.HttpServerRequest) {
        const back = localPath(queryOf(request).get("return"))
        if (!auth.providers.microsoft) return pages.message("Cannot sign in", "Microsoft sign-in is not set up.")
        const failed = `${SIGN_IN_PATH}?${new URLSearchParams({ return: back, failed: "1" })}`
        const started = yield* auth.startMicrosoftSignIn(back, failed, new Headers(request.headers)).pipe(
          Effect.tapError((error) => Effect.logError("Microsoft sign-in did not start", error)),
          Effect.option,
        )
        if (Option.isNone(started)) return pages.message("Cannot sign in", "Microsoft sign-in is not available now.")
        return redirectWithCookies(started.value.url, started.value.response)
      }),
    )
  }),
)
