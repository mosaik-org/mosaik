import type { Content } from "@mosaik/notifications/contract"
import { Data, type Effect } from "effect"

/** `email` and `slack-user` deliver to an address; `target` to an admin-configured channel. */
export type ChannelName = "email" | "slack-user" | "target"

/** A claimed delivery, ready to send. */
export interface OutgoingDelivery {
  readonly id: number
  readonly messageId: number
  /** Notifications go to people who chose them (and can change that); messages are sent as asked. */
  readonly category: "message" | "notification"
  readonly source: string
  readonly kind: string | null
  /** A notification's subject, whose page its links to people go through. */
  readonly subject: string | null
  readonly channel: string
  /** Channel-specific address, e.g. an e-mail address. */
  readonly recipient: string
  readonly recipientName: string | null
  /** Including the current one. */
  readonly attempts: number
  readonly content: Content
}

/** Sending failed. Permanent failures (rejected address, invalid content) are not retried. */
export class DeliveryFailure extends Data.TaggedError("DeliveryFailure")<{
  readonly message: string
  readonly permanent: boolean
}> {}

/** Renders content for one channel and hands it to the external system. */
export interface Channel {
  readonly name: ChannelName
  send(delivery: OutgoingDelivery): Effect.Effect<{ readonly providerId: string | null }, DeliveryFailure>
}
