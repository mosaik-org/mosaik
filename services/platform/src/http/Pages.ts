import { type AppRole, signInUrl } from "@mosaik/auth/contract"
import type { Principal } from "@mosaik/core"
import { type AccessRequest, REQUEST_ACCESS_PATH } from "@mosaik/platform/contract"
import { CorePages, escapeHtml, formOf, isUnder, localPath, pathOf } from "@mosaik/server"
import { DateTime, Effect, Option } from "effect"
import { HttpRouter, type HttpServerRequest, HttpServerResponse } from "effect/http"
import { AccessRequests } from "../AccessRequests"
import { Apps } from "../Apps"
import { Ownership } from "../Ownership"

/** What people may ask for: the app's current roles, not the owners'. */
const requestable = (roles: ReadonlyArray<AppRole>) => roles.filter((role) => !role.stale && !role.isOwner)

const appOf = (request: HttpServerRequest.HttpServerRequest) =>
  decodeURIComponent(new URL(request.url, "http://core").pathname.slice(`${REQUEST_ACCESS_PATH}/`.length))

/**
 * Core's page for asking for access to an app: pick one of its roles, say why, send. Anyone
 * signed in may use it; it is how standalone apps (and e-mails) let people ask without the
 * Portal. The app's owners, or the admins, get the request as from the Portal's dialog.
 */
export const RequestAccessRoutes = HttpRouter.use(
  Effect.fn(function* (router) {
    const pages = yield* CorePages
    const ownership = yield* Ownership
    const requests = yield* AccessRequests
    const apps = yield* Apps

    /** Where "back" goes: a path on Core's origin, or an address under the app's own (standalone). */
    const backOf = Effect.fn(function* (app: string, value: string | null) {
      if (value === null) return Option.none<string>()
      if (value.startsWith("/")) return Option.some(localPath(value))
      const publicUrl = Option.flatMapNullishOr(yield* apps.get(app), (record) => record.publicUrl)
      return Option.filter(publicUrl, (base) => isUnder(value, base)).pipe(Option.as(value))
    })

    const backLink = (back: Option.Option<string>, label: string) =>
      Option.match(back, {
        onNone: () => undefined,
        onSome: (href) => ({ href, label }),
      })

    /** The page, or why it cannot be shown; anonymous people sign in first. */
    const context = Effect.fn(function* (request: HttpServerRequest.HttpServerRequest) {
      const principal = yield* pages.principal(request)
      if (principal.user === null) return { _tag: "SignIn" as const }
      const about = yield* ownership.about(appOf(request)).pipe(Effect.option)
      return { _tag: "Ready" as const, principal, about }
    })

    const roleChoice = (role: AppRole, checked: boolean) => `<label class="choice">
  <input type="radio" name="role" value="${escapeHtml(role.id)}"${checked ? " checked" : ""}>
  <span><strong>${escapeHtml(role.name)}</strong>${role.description === null ? "" : `<br><span class="hint">${escapeHtml(role.description)}</span>`}</span>
</label>`

    const form = (
      principal: Principal,
      name: string,
      roles: ReadonlyArray<AppRole>,
      back: string | null,
      error?: string,
    ) =>
      pages.page({
        title: `Request access to ${name}`,
        body: `<h1>Request access to ${escapeHtml(name)}</h1>
<p class="hint">As ${escapeHtml(principal.user?.email ?? "")}</p>
${error === undefined ? "" : `<p class="error">${escapeHtml(error)}</p>`}
<form method="post">
  ${back === null ? "" : `<input type="hidden" name="return" value="${escapeHtml(back)}">`}
  ${
    roles.length === 0
      ? ""
      : `<fieldset><legend class="hint">What do you need?</legend>${roles.map((role, index) => roleChoice(role, index === 0)).join("\n")}</fieldset>`
  }
  <label>Why (optional) <textarea name="message" rows="3" maxlength="500"></textarea></label>
  <button type="submit">Send request</button>
</form>
<p class="hint">${escapeHtml(name)}'s owners decide, or the admins when it has none. You get a notification with the answer.</p>`,
      })

    yield* router.add(
      "GET",
      `${REQUEST_ACCESS_PATH}/:app`,
      Effect.fn("RequestAccess.page")(function* (request: HttpServerRequest.HttpServerRequest) {
        const page = yield* context(request)
        if (page._tag === "SignIn") return HttpServerResponse.redirect(signInUrl(pathOf(request)))
        if (Option.isNone(page.about)) return pages.message("Unknown app", "There is no such app.")
        const { app } = page.about.value
        const back = yield* backOf(app.id, new URL(request.url, "http://core").searchParams.get("return"))
        if (page.principal.can(app.access)) {
          return pages.message(
            `You can use ${app.name}`,
            "You already have access.",
            backLink(back, `Open ${app.name}`),
          )
        }
        const user = page.principal.user
        const pending = (user === null ? [] : yield* requests.mine(user.id)).find(
          (entry: AccessRequest) => entry.app === app.id && entry.status === "pending",
        )
        if (pending !== undefined) {
          const asked = new Date(DateTime.toEpochMillis(pending.createdAt)).toISOString().slice(0, 10)
          return pages.message(
            "Your request is waiting",
            `You asked for access to ${app.name} on ${asked}. You get a notification with the answer.`,
            backLink(back, "Back"),
          )
        }
        return form(page.principal, app.name, requestable(app.roles), Option.getOrNull(back))
      }),
    )

    yield* router.add(
      "POST",
      `${REQUEST_ACCESS_PATH}/:app`,
      Effect.fn("RequestAccess.send")(function* (request: HttpServerRequest.HttpServerRequest) {
        const page = yield* context(request)
        if (page._tag === "SignIn") return HttpServerResponse.redirect(signInUrl(pathOf(request)), { status: 303 })
        if (Option.isNone(page.about)) return pages.message("Unknown app", "There is no such app.")
        const { app, owners } = page.about.value
        const params = yield* formOf(request)
        const back = yield* backOf(app.id, params.get("return"))
        const message = params.get("message")?.trim().slice(0, 500) || null
        const sent = yield* requests.request(page.principal, app.id, params.get("role"), message).pipe(Effect.result)
        if (sent._tag === "Failure") {
          const reason = sent.failure._tag === "NotFound" ? "This app no longer exists." : sent.failure.message
          return form(page.principal, app.name, requestable(app.roles), Option.getOrNull(back), reason)
        }
        const who = owners.length > 0 ? `${app.name}'s owners` : "The admins"
        return pages.message(
          "Request sent",
          `${who} will look at it. You get a notification with the answer.`,
          backLink(back, "Back"),
        )
      }),
    )
  }),
)
