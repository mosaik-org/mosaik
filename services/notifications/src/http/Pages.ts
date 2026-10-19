import { signInUrl } from "@mosaik/auth/contract"
import type { PersonalChannel } from "@mosaik/core"
import { NOTIFICATION_SETTINGS_PAGE } from "@mosaik/notifications/contract"
import { CorePages, escapeHtml, formOf, pathOf } from "@mosaik/server"
import { Effect } from "effect"
import { HttpRouter, type HttpServerRequest, HttpServerResponse } from "effect/http"
import { Channels } from "../delivery/Channels"
import { effectiveSettings, Preferences } from "../notify/Preferences"
import { NotificationTypes } from "../notify/Types"

const LABELS: Record<PersonalChannel, string> = { inApp: "In the app", email: "E-mail", slack: "Slack" }

/**
 * Core's page for choosing which notifications someone gets, on which channel: one checkbox per
 * type and channel the deployment has. Every notification e-mail links to it, so people can
 * change it whether or not they use the Portal (whose settings page does the same).
 */
export const PreferencesPage = HttpRouter.use(
  Effect.fn(function* (router) {
    const pages = yield* CorePages
    const types = yield* NotificationTypes
    const preferences = yield* Preferences
    const channels = yield* Channels

    /** Every type with its effective settings for the user. */
    const settingsOf = Effect.fn(function* (userId: string) {
      const choices = yield* preferences.forUser(userId)
      return (yield* types.list).map((type) => ({
        type,
        channels: effectiveSettings(type.defaultChannels, choices.get(type.key) ?? {}),
      }))
    })

    const signedIn = (request: HttpServerRequest.HttpServerRequest) =>
      Effect.map(pages.principal(request), (principal) => principal.user)

    yield* router.add(
      "GET",
      NOTIFICATION_SETTINGS_PAGE,
      Effect.fn("Preferences.page")(function* (request: HttpServerRequest.HttpServerRequest) {
        const user = yield* signedIn(request)
        if (user === null) return HttpServerResponse.redirect(signInUrl(pathOf(request)))
        const available = channels.personal
        const rows = yield* settingsOf(user.id)
        const saved = new URL(request.url, "http://core").searchParams.has("saved")
        return pages.page({
          title: "Notifications",
          body: `<h1>Which notifications you get</h1>
<p class="hint">As ${escapeHtml(user.email)}</p>
${saved ? `<p>Saved.</p>` : ""}
${
  rows.length === 0
    ? `<p>No app sends notifications yet.</p>`
    : `<form method="post">
<table>
  <thead><tr><th>Notification</th>${available.map((channel) => `<th class="check">${LABELS[channel]}</th>`).join("")}</tr></thead>
  <tbody>
${rows
  .map(
    ({ type, channels: chosen }) =>
      `    <tr><td>${escapeHtml(type.description)}<br><span class="hint">${escapeHtml(type.source)}</span></td>${available
        .map(
          (channel) =>
            `<td class="check"><input type="checkbox" name="on" value="${escapeHtml(`${type.key}|${channel}`)}" aria-label="${escapeHtml(`${type.description}: ${LABELS[channel]}`)}"${chosen[channel] ? " checked" : ""}></td>`,
        )
        .join("")}</tr>`,
  )
  .join("\n")}
  </tbody>
</table>
<button type="submit">Save</button>
</form>`
}`,
        })
      }),
    )

    yield* router.add(
      "POST",
      NOTIFICATION_SETTINGS_PAGE,
      Effect.fn("Preferences.save")(function* (request: HttpServerRequest.HttpServerRequest) {
        const user = yield* signedIn(request)
        if (user === null) return HttpServerResponse.redirect(signInUrl(NOTIFICATION_SETTINGS_PAGE), { status: 303 })
        const on = new Set((yield* formOf(request)).getAll("on"))
        // Only what changed becomes a choice: the rest keeps following the type's defaults.
        for (const { type, channels: current } of yield* settingsOf(user.id)) {
          for (const channel of channels.personal) {
            const wanted = on.has(`${type.key}|${channel}`)
            if (wanted !== current[channel]) yield* preferences.set(user.id, type.key, channel, wanted)
          }
        }
        return HttpServerResponse.redirect(`${NOTIFICATION_SETTINGS_PAGE}?saved`, { status: 303 })
      }),
    )
  }),
)
