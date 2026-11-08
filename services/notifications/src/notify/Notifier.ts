import { BadRequest } from "@mosaik/core"
import {
  NotificationAccepted,
  type NotificationRequest,
  Resolved,
  type ResolveRequest,
} from "@mosaik/notifications/contract"
import { Context, Effect, Layer, Option } from "effect"
import { Channels } from "../delivery/Channels"
import { Outbox, type Recipient } from "../delivery/Outbox"
import { Fanout } from "../inbox/Fanout"
import { Inbox } from "../inbox/Inbox"
import { Directory } from "../messages/Directory"
import { Routes } from "../targets/Routes"
import { isEnabled, Preferences } from "./Preferences"
import { NotificationTypes } from "./Types"

/**
 * Turns a notification into inbox items and deliveries: resolves the audience, applies
 * each user's channel choices (falling back to the type's defaults), adds the targets
 * admins routed the type to, then queues everything in one transaction.
 */
export class Notifier extends Context.Service<
  Notifier,
  {
    notify(request: NotificationRequest): Effect.Effect<NotificationAccepted, BadRequest>
    /** The source handled what a subject is about: everyone's open items about it are resolved. */
    resolve(request: ResolveRequest): Effect.Effect<Resolved, BadRequest>
  }
>()("@mosaik/notifications-service/Notifier") {
  static readonly layer = Layer.effect(
    Notifier,
    Effect.gen(function* () {
      const types = yield* NotificationTypes
      const preferences = yield* Preferences
      const directory = yield* Directory
      const channels = yield* Channels
      const routes = yield* Routes
      const outbox = yield* Outbox
      const fanout = yield* Fanout
      const inbox = yield* Inbox

      return Notifier.of({
        notify: Effect.fn("Notifier.notify")(function* (request: NotificationRequest) {
          yield* Effect.annotateCurrentSpan({ "mosaik.notification.type": request.type })
          if (request.idempotencyKey !== null) {
            const existing = yield* outbox.findByIdempotencyKey(request.source, request.idempotencyKey)
            if (Option.isSome(existing)) {
              return new NotificationAccepted({
                id: existing.value.id,
                recipients: existing.value.users,
                deliveries: existing.value.deliveries,
                duplicate: true,
              })
            }
          }

          const type = yield* types.get(request.type)
          if (Option.isNone(type) || type.value.source !== request.source) {
            return yield* new BadRequest({
              message: `Unknown notification type "${request.type}" (declare it in the manifest of "${request.source}")`,
            })
          }
          // What it is about is what the app resolves it by: an action without one could never close.
          if (type.value.action && request.subject === null) {
            return yield* new BadRequest({
              message: `"${request.type}" asks for action: send it with a subject, which resolving it names`,
            })
          }

          const excluded = new Set<string>(request.exclude)
          const users = (yield* directory.audience(request.audience)).filter((user) => !excluded.has(user.id))
          const choices = yield* preferences.forType(
            type.value.key,
            users.map((user) => user.id),
          )
          const defaults = type.value.defaultChannels
          const available = new Set(channels.personal)
          const wants = (userId: string, channel: "inApp" | "email" | "slack") =>
            available.has(channel) && isEnabled(defaults, choices.get(userId) ?? {}, channel)

          const inbox: Array<string> = []
          const recipients: Array<Recipient> = []
          for (const user of users) {
            if (wants(user.id, "inApp")) inbox.push(user.id)
            if (wants(user.id, "email")) {
              recipients.push({ channel: "email", address: user.email, name: user.name, userId: user.id })
            }
            if (wants(user.id, "slack")) {
              recipients.push({ channel: "slack-user", address: user.email, name: user.name, userId: user.id })
            }
          }
          for (const targetId of yield* routes.targetsFor(type.value.key)) {
            recipients.push({ channel: "target", address: targetId, name: null, userId: null })
          }

          const queued = yield* outbox.enqueue({
            category: "notification",
            source: request.source,
            kind: type.value.key.slice(request.source.length + 1),
            content: request.content,
            idempotencyKey: request.idempotencyKey,
            recipients,
            subject: request.subject,
            inbox: { userIds: inbox, action: type.value.action, guarded: type.value.resolvedBy === "app" },
          })
          if (!queued.duplicate) {
            if (queued.inbox > 0) yield* fanout.announce(queued.id)
            if (queued.deliveries > 0) yield* outbox.wake
            yield* Effect.logInfo("Queued notification", {
              id: queued.id,
              type: type.value.key,
              audience: users.length,
              inbox: queued.inbox,
              deliveries: queued.deliveries,
            })
          }
          return new NotificationAccepted({
            id: queued.id,
            recipients: queued.users,
            deliveries: queued.deliveries,
            duplicate: queued.duplicate,
          })
        }),

        resolve: Effect.fn("Notifier.resolve")(function* (request: ResolveRequest) {
          // Named as people know them; an unknown id is the app's mistake, not something to show.
          const by = request.by === null ? null : (yield* directory.users([request.by]))[0]
          const userIds = yield* inbox.resolveSubject(
            request.source,
            request.subject,
            by === undefined || by === null ? null : { id: by.id, name: by.name },
          )
          if (userIds.length > 0) {
            yield* fanout.announceChanged(userIds)
            yield* Effect.logInfo("Resolved notifications", {
              source: request.source,
              subject: request.subject,
              items: userIds.length,
            })
          }
          return new Resolved({ items: userIds.length })
        }),
      })
    }),
  )
}
