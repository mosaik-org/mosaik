import { UserId } from "@mosaik/core"
import { Schema } from "effect"

export const EmailAddress = Schema.String.check(
  Schema.isMaxLength(254),
  Schema.isPattern(/^[^\s@<>()[\]",;:\\]+@[^\s@<>()[\]",;:\\]+\.[^\s@<>()[\]",;:\\]+$/, {
    message: "A valid e-mail address",
  }),
)

/** Id of an admin-configured Teams or Slack channel, e.g. `ops-alerts`. */
export const TargetId = Schema.String.check(
  Schema.isMaxLength(64),
  Schema.isPattern(/^[a-z][a-z0-9-]*$/, { message: "Lowercase letters, digits and dashes" }),
)

/** Where a message goes. Each destination becomes one delivery. */
export const Destination = Schema.TaggedUnion({
  /** Any address. Addresses outside `MAIL_ALLOWED_DOMAINS` are rejected. */
  Email: {
    address: EmailAddress,
    name: Schema.optional(
      Schema.String.check(
        Schema.isMaxLength(100),
        Schema.isPattern(/^[^\r\n]*$/, { message: "Must not contain line breaks" }),
      ),
    ),
  },
  /** A Mosaik user, reached at their account e-mail address (always allowed). */
  User: { userId: UserId },
  /** A Teams or Slack channel configured by an admin; it may be limited to some sources. */
  Target: { targetId: TargetId },
})
export type Destination = typeof Destination.Type

/**
 * Destination constructors.
 *
 * @example
 * messages.send({ to: [To.email("finance@partner.com"), To.user(order.ownerId), To.target("sales")], content })
 */
export const To = {
  email: (address: string, name?: string): Destination =>
    name === undefined ? { _tag: "Email", address } : { _tag: "Email", address, name },
  user: (userId: UserId): Destination => ({ _tag: "User", userId }),
  target: (targetId: string): Destination => ({ _tag: "Target", targetId }),
}
