import type { NotificationKey, UserId } from "@mosaik/core"
import type { Audience, Content, NotificationAccepted, Resolved } from "@mosaik/notifications/contract"
import { AppNotificationRequest, AppResolveRequest } from "@mosaik/platform/contract"
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
  /**
   * What it is about, e.g. `refund:${refund.id}`: required for an action type. A later notification about
   * it updates the person's open item instead of adding one, and `resolve` resolves them by it.
   */
  readonly subject?: string
  /** Sending again with the same key returns the first notification instead of notifying twice. */
  readonly idempotencyKey?: string
}

export interface ResolveOptions {
  /** Who handled it, shown with the items ("Resolved by Ada"); the app otherwise. */
  readonly by?: UserId
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
 * In people's inboxes, an action type's items stay open until they are resolved: `resolve` them by
 * their subject when what they are about is handled, wherever and by whoever.
 *
 * @example
 * const notify = yield* Notify
 * yield* notify.send({
 *   type: sales.notification("refund.approval"),
 *   audience: Audiences.permission(sales.perm("orders.refund")),
 *   exclude: [actor.id],
 *   subject: `refund:${refund.id}`,
 *   content: { title: `Approve the refund of ${order.number}`, link: `/sales/orders/${order.id}` },
 * })
 * // Once someone approved or rejected it:
 * yield* notify.resolve(`refund:${refund.id}`, { by: actor.id })
 */
export class Notify extends Context.Service<
  Notify,
  {
    send(notification: SendNotification): Effect.Effect<NotificationAccepted, NotifyError>
    /** Resolves the open items about a subject, for everyone they reached. */
    resolve(subject: string, options?: ResolveOptions): Effect.Effect<Resolved, NotifyError>
  }
>()("@mosaik/server/Notify") {
  static readonly layer = Layer.effect(
    Notify,
    Effect.gen(function* () {
      const client = yield* PlatformClient
      const registration = yield* Registration
      const decode = Schema.decodeUnknownEffect(AppNotificationRequest)
      const decodeResolve = Schema.decodeUnknownEffect(AppResolveRequest)
      const rejected = (issue: { readonly message: string }) =>
        new NotifyError({ reason: "Rejected", message: issue.message })
      /** Retries a moment of unavailability; a rejection is final. */
      const call = <A>(request: Effect.Effect<A, { readonly _tag: string; readonly message?: string }>) =>
        request.pipe(
          Effect.retry({
            while: (error) => error._tag !== "BadRequest",
            schedule: Schedule.exponential("200 millis"),
            times: 3,
          }),
          Effect.mapError((error) =>
            error._tag === "BadRequest"
              ? new NotifyError({ reason: "Rejected", message: error.message ?? "Rejected" })
              : new NotifyError({ reason: "Unavailable", message: "Platform unavailable" }),
          ),
        )

      return Notify.of({
        send: Effect.fn("Notify.send")(function* (notification: SendNotification) {
          const payload = yield* decode({
            type: notification.type,
            audience: notification.audience,
            content: notification.content,
            exclude: notification.exclude ?? [],
            subject: notification.subject ?? null,
            idempotencyKey: notification.idempotencyKey ?? null,
          }).pipe(Effect.mapError(rejected))

          // At startup, the type may not be registered yet.
          yield* registration.done.pipe(Effect.timeoutOption(REGISTRATION_WAIT))
          return yield* call(client.app.notifications({ payload })).pipe(
            Effect.tapError((error) => Effect.logError("Failed to send notification", error)),
          )
        }),

        resolve: Effect.fn("Notify.resolve")(function* (subject: string, options?: ResolveOptions) {
          const payload = yield* decodeResolve({ subject, by: options?.by ?? null }).pipe(Effect.mapError(rejected))
          return yield* call(client.app.resolveNotifications({ payload })).pipe(
            Effect.tapError((error) => Effect.logError("Failed to resolve notifications", error)),
          )
        }),
      })
    }),
  )
}
