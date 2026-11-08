import { signInUrl } from "@mosaik/auth/contract"
import type { PersonalChannel } from "@mosaik/core"
import { NOTIFICATION_LINK_PAGE, NOTIFICATION_SETTINGS_PAGE, type Resolution } from "@mosaik/notifications/contract"
import { CorePages, escapeHtml, formOf, pathOf } from "@mosaik/server"
import { Effect, Option } from "effect"
import { HttpRouter, type HttpServerRequest, HttpServerResponse } from "effect/http"
import { Channels } from "../delivery/Channels"
import { Inbox } from "../inbox/Inbox"
import { NotificationsConfig } from "../NotificationsConfig"
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

/** "2 hours ago": as near as it matters, and the same in every time zone. */
export const timeAgo = (then: number, now: number): string => {
  const minutes = Math.round((now - then) / 60_000)
  const plural = (count: number, unit: string) => `${count} ${unit}${count === 1 ? "" : "s"} ago`
  if (minutes < 1) return "just now"
  if (minutes < 60) return plural(minutes, "minute")
  const hours = Math.round(minutes / 60)
  if (hours < 24) return plural(hours, "hour")
  return plural(Math.round(hours / 24), "day")
}

const resolvedBy = (resolution: Resolution, now: number) =>
  `Resolved ${resolution.by === null ? "" : `by ${escapeHtml(resolution.by.name)} `}${timeAgo(resolution.at.epochMilliseconds, now)}.`

/**
 * Where a link in an e-mail or a Slack message about a subject leads first. Such a message cannot be
 * taken back, so before going on to what it links to, this page says when it was already resolved,
 * and by whom. The link is the notification's own, read from it: the page sends nobody anywhere else.
 */
export const LinkPage = HttpRouter.use(
  Effect.fn(function* (router) {
    const pages = yield* CorePages
    const inbox = yield* Inbox
    const config = yield* NotificationsConfig

    const absolute = (link: string) => (link.startsWith("/") ? new URL(link, config.publicUrl).toString() : link)

    yield* router.add(
      "GET",
      NOTIFICATION_LINK_PAGE,
      Effect.fn("Notifications.link")(function* (request: HttpServerRequest.HttpServerRequest) {
        const user = (yield* pages.principal(request)).user
        if (user === null) return HttpServerResponse.redirect(signInUrl(pathOf(request)))
        const message = Number(new URL(request.url, "http://core").searchParams.get("message"))
        const target = Number.isSafeInteger(message) ? yield* inbox.linkTarget(user.id, message) : Option.none()
        if (Option.isNone(target)) {
          return pages.page({
            title: "Notification",
            status: 404,
            body: `<h1>Nothing to show</h1>\n<p>This notification was not sent to ${escapeHtml(user.email)}, or is gone.</p>`,
          })
        }
        const { title, link, resolution, itemId } = target.value
        if (Option.isSome(itemId)) yield* inbox.markRead(user.id, [itemId.value])
        if (Option.isNone(resolution) && link !== undefined) return HttpServerResponse.redirect(absolute(link))
        return pages.page({
          title: "Notification",
          body: `<h1>${escapeHtml(title)}</h1>
${Option.isSome(resolution) ? `<p>${resolvedBy(resolution.value, Date.now())}</p>` : ""}
${link === undefined ? "" : `<p><a href="${escapeHtml(absolute(link))}">${Option.isSome(resolution) ? "Open it anyway" : "Open it"}</a></p>`}`,
        })
      }),
    )
  }),
)
