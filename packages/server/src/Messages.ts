import type { Content, Destination, MessageAccepted } from "@mosaik/notifications/contract"
import { AppMessageRequest } from "@mosaik/platform/contract"
import { PlatformClient } from "@mosaik/platform/server"
import { Context, Effect, Layer, Schedule, Schema } from "effect"

export interface SendMessage {
  /** May be empty for a `kind` that admins route to Teams or Slack channels. */
  readonly to: ReadonlyArray<Destination>
  readonly content: Content
  /** What kind of message this is, e.g. `daily-report`. Shown in the delivery log and used for routing. */
  readonly kind?: string
  /** Sending again with the same key returns the first message instead of sending twice. */
  readonly idempotencyKey?: string
}

export class MessageError extends Schema.TaggedError<MessageError>()("MessageError", {
  /**
   * - `Rejected`: invalid content or destination, or a domain that is not allowed (do not retry)
   * - `RateLimited`: too many messages; try again later
   * - `Unavailable`: the notifications service could not be reached
   */
  reason: Schema.Literals(["Rejected", "RateLimited", "Unavailable"]),
  message: Schema.String,
}) {}

/**
 * Sends messages (e-mail, Teams and Slack channels) through the platform API; they are
 * attributed to the calling app. `send` succeeds once the message is queued; delivery is
 * asynchronous, with retries, and visible in the delivery log.
 *
 * @example
 * const messages = yield* Messages
 * yield* messages.send({
 *   to: [To.email("finance@partner.com")],
 *   kind: "refund-report",
 *   content: { title: `Refund for ${order.number}`, body: reason, link: `/sales/orders/${order.id}` },
 * })
 */
export class Messages extends Context.Service<
  Messages,
  { send(message: SendMessage): Effect.Effect<MessageAccepted, MessageError> }
>()("@mosaik/server/Messages") {
  static readonly layer = Layer.effect(
    Messages,
    Effect.gen(function* () {
      const client = yield* PlatformClient
      const decode = Schema.decodeUnknownEffect(AppMessageRequest)

      return Messages.of({
        send: Effect.fn("Messages.send")(function* (message: SendMessage) {
          const payload = yield* decode({
            kind: message.kind ?? null,
            to: message.to,
            content: message.content,
            idempotencyKey: message.idempotencyKey ?? null,
          }).pipe(Effect.mapError((issue) => new MessageError({ reason: "Rejected", message: issue.message })))

          return yield* client.app.messages({ payload }).pipe(
            Effect.retry({
              while: (error) => error._tag !== "BadRequest" && error._tag !== "RateLimited",
              schedule: Schedule.exponential("200 millis"),
              times: 3,
            }),
            Effect.mapError((error) =>
              error._tag === "BadRequest"
                ? new MessageError({ reason: "Rejected", message: error.message })
                : error._tag === "RateLimited"
                  ? new MessageError({ reason: "RateLimited", message: error.message })
                  : new MessageError({ reason: "Unavailable", message: "Platform unavailable" }),
            ),
            Effect.tapError((error) =>
              error.reason === "Unavailable" ? Effect.logError("Failed to send message", error) : Effect.void,
            ),
          )
        }),
      })
    }),
  )
}
