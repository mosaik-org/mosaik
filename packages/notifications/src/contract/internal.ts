import { InternalAuth } from "@mosaik/auth/contract"
import { BadRequest, PersonalChannel, UserId } from "@mosaik/core"
import { Schema } from "effect"
import { HttpApi, HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/http-api"
import { Audience } from "./audience"
import { Content } from "./content"
import { Destination } from "./destination"

/** Maximum destinations per message. */
export const MAX_DESTINATIONS = 50

const Slug = Schema.String.check(
  Schema.isMaxLength(64),
  Schema.isPattern(/^[a-z][a-z0-9.-]*$/, { message: "Lowercase letters, digits, dots and dashes" }),
)

export class MessageRequest extends Schema.Class<MessageRequest>("@mosaik/notifications/MessageRequest")({
  /** The sending service (app id). Used for attribution, rate limits and idempotency. */
  source: Slug,
  /**
   * What kind of message this is, e.g. `daily-report`. Shown in the delivery log; admins can
   * route a kind (`<source>:<kind>`) to Teams or Slack channels.
   */
  kind: Schema.NullOr(Slug),
  /** May be empty for a `kind` that admins route to channels. */
  to: Schema.Array(Destination).check(Schema.isMaxLength(MAX_DESTINATIONS)),
  content: Content,
  /** Sending again with the same key (per source) returns the first message instead of sending twice. */
  idempotencyKey: Schema.NullOr(Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(200))),
}) {}

export class MessageAccepted extends Schema.Class<MessageAccepted>("@mosaik/notifications/MessageAccepted")({
  id: Schema.Number,
  /** Number of deliveries queued (destinations after de-duplication). */
  deliveries: Schema.Number,
  /** An earlier request with the same idempotency key already created this message. */
  duplicate: Schema.Boolean,
}) {}

/** A notification type declared in an app manifest. */
export class NotificationTypeInput extends Schema.Class<NotificationTypeInput>(
  "@mosaik/notifications/NotificationTypeInput",
)({
  /** `<source>:<name>`, e.g. `sales:order.refunded`. */
  key: Schema.String,
  description: Schema.String,
  defaultChannels: Schema.Array(PersonalChannel),
}) {}

export class NotificationTypesPayload extends Schema.Class<NotificationTypesPayload>(
  "@mosaik/notifications/NotificationTypesPayload",
)({
  source: Slug,
  /** Every type of the source; types missing from the list are marked stale. */
  types: Schema.Array(NotificationTypeInput),
}) {}

export class NotificationRequest extends Schema.Class<NotificationRequest>("@mosaik/notifications/NotificationRequest")(
  {
    source: Slug,
    /** A registered type of the source, e.g. `sales:order.refunded`. */
    type: Schema.String,
    audience: Audience,
    content: Content,
    /** Users left out even if they are in the audience, typically whoever triggered it. */
    exclude: Schema.Array(UserId),
    idempotencyKey: Schema.NullOr(Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(200))),
  },
) {}

export class NotificationAccepted extends Schema.Class<NotificationAccepted>(
  "@mosaik/notifications/NotificationAccepted",
)({
  id: Schema.Number,
  /** Users the notification reached on at least one channel. */
  recipients: Schema.Number,
  /** Deliveries queued (e-mail, Slack, routed channels); in-app items are not counted. */
  deliveries: Schema.Number,
  duplicate: Schema.Boolean,
}) {}

/** The source sent too many messages; try again after `retryAfterMs`. */
export class RateLimited extends Schema.TaggedError<RateLimited>()(
  "RateLimited",
  { message: Schema.String, retryAfterMs: Schema.Number },
  { httpApiStatus: 429 },
) {}

export class MessagesGroup extends HttpApiGroup.make("messages")
  .add(
    /** Queue a message for delivery. Delivery itself is asynchronous, with retries. */
    HttpApiEndpoint.post("send", "/messages", {
      payload: MessageRequest,
      success: MessageAccepted,
      error: [BadRequest, RateLimited],
    }),
  )
  .middleware(InternalAuth) {}

export class NotificationsGroup extends HttpApiGroup.make("notifications")
  .add(
    /** Register an app's notification types (at startup). */
    HttpApiEndpoint.put("registerTypes", "/notification-types", {
      payload: NotificationTypesPayload,
      success: HttpApiSchema.NoContent,
      error: BadRequest,
    }),
    /** Notify an audience; each user gets it on the channels they chose. */
    HttpApiEndpoint.post("send", "/notifications", {
      payload: NotificationRequest,
      success: NotificationAccepted,
      error: BadRequest,
    }),
  )
  .middleware(InternalAuth) {}

/** Service-to-service API of the notifications service. Never exposed through the gateway. */
export class NotificationsInternalApi extends HttpApi.make("notifications-internal")
  .add(MessagesGroup, NotificationsGroup)
  .prefix("/internal") {}
