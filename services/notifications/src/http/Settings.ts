import { BadRequest, NotFound } from "@mosaik/core"
import { NotificationSettings, NotificationsApi, NotificationTypeSettings } from "@mosaik/notifications/contract"
import { Effect, Option } from "effect"
import { HttpApiBuilder } from "effect/http-api"
import { Channels } from "../delivery/Channels"
import { effectiveSettings, Preferences } from "../notify/Preferences"
import { type NotificationType, NotificationTypes } from "../notify/Types"
import { currentUserId } from "./Inbox"

export const SettingsHandlers = HttpApiBuilder.group(
  NotificationsApi,
  "settings",
  Effect.fn(function* (handlers) {
    const types = yield* NotificationTypes
    const preferences = yield* Preferences
    const channels = yield* Channels

    const settingsOf = (type: NotificationType, choices: Parameters<typeof effectiveSettings>[1]) =>
      new NotificationTypeSettings({
        key: type.key,
        source: type.source,
        description: type.description,
        channels: effectiveSettings(type.defaultChannels, choices),
      })

    return handlers.handleAll({
      get: Effect.fn(function* () {
        const userId = yield* currentUserId
        const choices = yield* preferences.forUser(userId)
        const all = yield* types.list
        return new NotificationSettings({
          available: channels.personal,
          types: all.map((type) => settingsOf(type, choices.get(type.key) ?? {})),
        })
      }),

      set: Effect.fn(function* ({ payload }) {
        const userId = yield* currentUserId
        const type = yield* types.get(payload.type)
        if (Option.isNone(type)) return yield* new NotFound({ resource: "notification type", id: payload.type })
        if (!channels.personal.includes(payload.channel)) {
          return yield* new BadRequest({ message: `The ${payload.channel} channel is not configured` })
        }
        yield* preferences.set(userId, payload.type, payload.channel, payload.enabled)
        const choices = yield* preferences.forUser(userId)
        return settingsOf(type.value, choices.get(payload.type) ?? {})
      }),
    })
  }),
)
