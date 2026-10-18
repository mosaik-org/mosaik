import type { NotificationKey, UserId } from "@mosaik/core"
import type { Audience, Content, NotificationAccepted } from "@mosaik/notifications/contract"
import { AppNotificationRequest } from "@mosaik/platform/contract"
import { PlatformClient } from "@mosaik/platform/server"
import { Context, Duration, Effect, Layer, Schedule, Schema } from "effect"
import { Registration } from "./Registration"

export interface SendNotification {
  /** A type from the app's manifest: `app.notification("order.refunded")`. */
  readonly type: NotificationKey
  readonly audience: Audience
  readonly content: Content
  /** Users left out even if they are in the audience, typically whoever triggered it. */
  readonly exclude?: ReadonlyArray<UserId>
  /** Sending again with the same key returns the first notification instead of notifying twice. */
  readonly idempotencyKey?: string
}

export class NotifyError extends Schema.TaggedError<NotifyError>()("NotifyError", {
  /**
   * - `Rejected`: unknown type, invalid content or audience (do not retry)
   * - `Unavailable`: the notifications service could not be reached
   */
  reason: Schema.Literals(["Rejected", "Unavailable"]),
  message: Schema.String,
}) {}

/** How long `send` waits for the app's types to be registered at startup. */
const REGISTRATION_WAIT = Duration.seconds(10)

/**
 * Notifies users through the platform API. Each user receives a notification on
 * the channels they chose for its type (in-app, e-mail, Slack); admins can also route a
 * type to Teams or Slack channels. Types are declared in the app manifest and
 * registered (with the rest of the manifest) when the backend starts.
 *
 * @example
 * const notify = yield* Notify
 * yield* notify.send({
 *   type: sales.notification("order.refunded"),
 *   audience: Audiences.permission(sales.perm("orders.refund")),
 *   exclude: [actor.id],
 *   content: { title: `${order.number} was refunded`, link: `/sales/orders/${order.id}` },
 * })
 */
export class Notify extends Context.Service<
  Notify,
  { send(notification: SendNotification): Effect.Effect<NotificationAccepted, NotifyError> }
>()("@mosaik/server/Notify") {
  static readonly layer = Layer.effect(
    Notify,
    Effect.gen(function* () {
      const client = yield* PlatformClient
      const registration = yield* Registration
      const decode = Schema.decodeUnknownEffect(AppNotificationRequest)

      return Notify.of({
        send: Effect.fn("Notify.send")(function* (notification: SendNotification) {
          const payload = yield* decode({
            type: notification.type,
            audience: notification.audience,
            content: notification.content,
            exclude: notification.exclude ?? [],
            idempotencyKey: notification.idempotencyKey ?? null,
          }).pipe(Effect.mapError((issue) => new NotifyError({ reason: "Rejected", message: issue.message })))

          // At startup, the type may not be registered yet.
          yield* registration.done.pipe(Effect.timeoutOption(REGISTRATION_WAIT))
          return yield* client.app.notifications({ payload }).pipe(
            Effect.retry({
              while: (error) => error._tag !== "BadRequest",
              schedule: Schedule.exponential("200 millis"),
              times: 3,
            }),
            Effect.mapError((error) =>
              error._tag === "BadRequest"
                ? new NotifyError({ reason: "Rejected", message: error.message })
                : new NotifyError({ reason: "Unavailable", message: "Platform unavailable" }),
            ),
            Effect.tapError((error) => Effect.logError("Failed to send notification", error)),
          )
        }),
      })
    }),
  )
}
