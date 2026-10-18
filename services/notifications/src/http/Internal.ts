import { NotificationsInternalApi } from "@mosaik/notifications/contract"
import { Effect } from "effect"
import { HttpApiBuilder } from "effect/http-api"
import { Dispatcher } from "../messages/Dispatcher"
import { Notifier } from "../notify/Notifier"
import { NotificationTypes } from "../notify/Types"

export const MessagesHandlers = HttpApiBuilder.group(
  NotificationsInternalApi,
  "messages",
  Effect.fn(function* (handlers) {
    const dispatcher = yield* Dispatcher
    return handlers.handle("send", ({ payload }) => dispatcher.dispatch(payload))
  }),
)

export const NotificationsHandlers = HttpApiBuilder.group(
  NotificationsInternalApi,
  "notifications",
  Effect.fn(function* (handlers) {
    const types = yield* NotificationTypes
    const notifier = yield* Notifier
    return handlers.handleAll({
      registerTypes: ({ payload }) => types.register(payload),
      send: ({ payload }) => notifier.notify(payload),
    })
  }),
)
