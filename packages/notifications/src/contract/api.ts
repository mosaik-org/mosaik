import {
  AccessControl,
  BadRequest,
  Conflict,
  NotFound,
  type PermissionKey,
  PersonalChannel,
  RequiredPermission,
  UserId,
} from "@mosaik/core"
import { Schema } from "effect"
import { HttpApi, HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/http-api"
import { Content } from "./content"
import { TargetId } from "./destination"

export const NOTIFICATIONS_API_PREFIX = "/api/notifications"

/** Admin permissions, declared in the admin app's manifest. */
export const NotificationsAdmin = {
  /** See targets, routing and the delivery log. */
  view: "admin:notifications.view" as PermissionKey,
  /** Change targets and routing, retry deliveries. */
  manage: "admin:notifications.manage" as PermissionKey,
}

// --- Inbox ------------------------------------------------------------------------------

/** Where an item is: waiting for someone, put away until a time, or handled. */
export const InboxState = Schema.Literals(["open", "snoozed", "resolved"])
export type InboxState = typeof InboxState.Type

/** When an item was resolved, and by whom. */
export class Resolution extends Schema.Class<Resolution>("@mosaik/notifications/Resolution")({
  at: Schema.DateTimeUtc,
  /** Who handled it; null when the app did not say. */
  by: Schema.NullOr(Schema.Struct({ id: UserId, name: Schema.String })),
  /**
   * The app resolved it, as what it is about was handled (anywhere, by `by`); otherwise the person
   * resolved their item themselves, and may open it again.
   */
  app: Schema.Boolean,
}) {}

/**
 * One thing in someone's inbox: a notification, or several about the same subject folded into one
 * (its content the newest's).
 */
export class InboxItem extends Schema.Class<InboxItem>("@mosaik/notifications/InboxItem")({
  id: Schema.Number,
  /** Notification type key of the newest notification, e.g. `sales:order.refunded`. */
  type: Schema.String,
  /** Sending app. */
  source: Schema.String,
  /** What it is about, e.g. `refund:42`; null for a notification that stands alone. */
  subject: Schema.NullOr(Schema.String),
  content: Content,
  /** It asks something of the person: open, it counts on the bell. */
  action: Schema.Boolean,
  /** The person may resolve it (information always; an action unless only its app may). */
  resolvable: Schema.Boolean,
  state: InboxState,
  /** How many notifications it holds: more than one when later ones about its subject updated it. */
  updates: Schema.Number,
  createdAt: Schema.DateTimeUtc,
  /** When the newest notification came. */
  updatedAt: Schema.DateTimeUtc,
  readAt: Schema.NullOr(Schema.DateTimeUtc),
  snoozedUntil: Schema.NullOr(Schema.DateTimeUtc),
  resolution: Schema.NullOr(Resolution),
}) {}

/** What the bell shows: open actions (a number), and whether anything open is unread (a dot). */
export class InboxCounts extends Schema.Class<InboxCounts>("@mosaik/notifications/InboxCounts")({
  /** Open action items, not snoozed. */
  actions: Schema.Number,
  /** Open items not yet read. */
  unread: Schema.Number,
}) {}

export class InboxPage extends Schema.Class<InboxPage>("@mosaik/notifications/InboxPage")({
  items: Schema.Array(InboxItem),
  counts: InboxCounts,
  nextCursor: Schema.NullOr(Schema.Number),
}) {}

/**
 * Sent on the live stream: when connecting and whenever the person's inbox changes, with `item` when a
 * notification added or updated one (to show it as it comes).
 */
export class InboxEvent extends Schema.Class<InboxEvent>("@mosaik/notifications/InboxEvent")({
  counts: InboxCounts,
  item: Schema.NullOr(InboxItem),
}) {}

const ItemIds = Schema.Struct({ ids: Schema.Array(Schema.Number).check(Schema.isMaxLength(500)) })

export class InboxGroup extends HttpApiGroup.make("inbox")
  .add(
    /** The items in one state, the newest first (by their newest notification). */
    HttpApiEndpoint.get("list", "/", {
      query: {
        state: Schema.optional(InboxState),
        before: Schema.optional(Schema.NumberFromString),
        limit: Schema.optional(Schema.NumberFromString),
      },
      success: InboxPage,
    }),
    HttpApiEndpoint.post("markRead", "/read", { payload: ItemIds, success: HttpApiSchema.NoContent }),
    HttpApiEndpoint.post("markAllRead", "/read-all", { success: HttpApiSchema.NoContent }),
    /** Resolves the items (information: done). An item only its app may resolve refuses all of them. */
    HttpApiEndpoint.post("resolve", "/resolve", {
      payload: ItemIds,
      success: HttpApiSchema.NoContent,
      error: Conflict,
    }),
    /** Opens again what the person resolved or snoozed (to undo); what the app resolved stays so. */
    HttpApiEndpoint.post("reopen", "/reopen", { payload: ItemIds, success: HttpApiSchema.NoContent }),
    /** Puts open items away until a time; they come back unread. */
    HttpApiEndpoint.post("snooze", "/snooze", {
      payload: Schema.Struct({ ...ItemIds.fields, until: Schema.DateTimeUtc }),
      success: HttpApiSchema.NoContent,
      error: BadRequest,
    }),
    /** Server-Sent Events of `InboxEvent`. */
    HttpApiEndpoint.get("live", "/live", {
      success: Schema.String.pipe(HttpApiSchema.asText({ contentType: "text/event-stream" })),
    }),
  )
  .prefix("/inbox") {}

export const inboxLiveUrl = `${NOTIFICATIONS_API_PREFIX}/inbox/live`

/**
 * Core's page that an e-mail or a Slack message about a subject links to (`?message=<id>`): it goes on
 * to the notification's link, or first says who resolved it and when, as a message cannot be taken back.
 */
export const NOTIFICATION_LINK_PAGE = `${NOTIFICATIONS_API_PREFIX}/go`

// --- Settings ---------------------------------------------------------------------------

/**
 * Core's page for choosing which notifications someone gets, on which channel (rendered by the
 * notifications service, so it works without the Portal). Every notification e-mail links to it.
 */
export const NOTIFICATION_SETTINGS_PAGE = `${NOTIFICATIONS_API_PREFIX}/preferences`

export const ChannelSettings = Schema.Struct({ inApp: Schema.Boolean, email: Schema.Boolean, slack: Schema.Boolean })
export type ChannelSettings = typeof ChannelSettings.Type

export class NotificationTypeSettings extends Schema.Class<NotificationTypeSettings>(
  "@mosaik/notifications/NotificationTypeSettings",
)({
  key: Schema.String,
  source: Schema.String,
  description: Schema.String,
  /** Effective settings: the user's choice, else the type's defaults. */
  channels: ChannelSettings,
}) {}

export class NotificationSettings extends Schema.Class<NotificationSettings>(
  "@mosaik/notifications/NotificationSettings",
)({
  /** Channels configured for this deployment (e-mail needs SMTP, Slack a bot token). */
  available: Schema.Array(PersonalChannel),
  types: Schema.Array(NotificationTypeSettings),
}) {}

export class SettingsGroup extends HttpApiGroup.make("settings")
  .add(
    HttpApiEndpoint.get("get", "/", { success: NotificationSettings }),
    HttpApiEndpoint.put("set", "/", {
      payload: Schema.Struct({ type: Schema.String, channel: PersonalChannel, enabled: Schema.Boolean }),
      success: NotificationTypeSettings,
      error: [NotFound, BadRequest],
    }),
  )
  .prefix("/settings") {}

// --- Admin ------------------------------------------------------------------------------

export const TargetKind = Schema.Literals(["slack-webhook", "slack-channel", "teams-webhook"])
export type TargetKind = typeof TargetKind.Type

const SourceList = Schema.Array(Schema.String.check(Schema.isPattern(/^[a-z][a-z0-9-]*$/, { message: "App ids" })))

export class Target extends Schema.Class<Target>("@mosaik/notifications/Target")({
  id: TargetId,
  name: Schema.String,
  kind: TargetKind,
  /** Where it posts, with secrets masked (e.g. `#alerts`, `hooks.slack.com/…/x1y2`). */
  address: Schema.String,
  /** Apps that may send to it explicitly (`To.target`); empty means all. Routing ignores this. */
  allowedSources: SourceList,
  createdAt: Schema.DateTimeUtc,
}) {}

const HttpsUrl = Schema.String.check(
  Schema.isMaxLength(2000),
  Schema.isPattern(/^https:\/\/\S+$/, { message: "An https URL" }),
)
const SlackChannel = Schema.String.check(
  Schema.isPattern(/^(#[a-z0-9_-]{1,80}|[CGD][A-Z0-9]{6,})$/, { message: "A channel id (C…) or #name" }),
)

export class CreateTarget extends Schema.Class<CreateTarget>("@mosaik/notifications/CreateTarget")({
  id: TargetId,
  name: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(100)),
  kind: TargetKind,
  /** Webhook URL (`slack-webhook`, `teams-webhook`). */
  url: Schema.optional(HttpsUrl),
  /** Channel (`slack-channel`); the Slack app must be in it. */
  channel: Schema.optional(SlackChannel),
  allowedSources: SourceList,
}) {}

export class UpdateTarget extends Schema.Class<UpdateTarget>("@mosaik/notifications/UpdateTarget")({
  name: Schema.optional(Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(100))),
  url: Schema.optional(HttpsUrl),
  channel: Schema.optional(SlackChannel),
  allowedSources: Schema.optional(SourceList),
}) {}

export class TestResult extends Schema.Class<TestResult>("@mosaik/notifications/TestResult")({
  ok: Schema.Boolean,
  error: Schema.NullOr(Schema.String),
}) {}

/** A notification type or message kind and the channels it is routed to. */
export class RoutingRule extends Schema.Class<RoutingRule>("@mosaik/notifications/RoutingRule")({
  /** `<source>:<name>`, e.g. `sales:order.refunded` or `sales:daily-report`. */
  key: Schema.String,
  category: Schema.Literals(["notification", "message"]),
  description: Schema.NullOr(Schema.String),
  targets: Schema.Array(TargetId),
}) {}

export const DeliveryStatus = Schema.Literals(["pending", "sending", "sent", "failed"])
export type DeliveryStatus = typeof DeliveryStatus.Type

export class DeliveryRecord extends Schema.Class<DeliveryRecord>("@mosaik/notifications/DeliveryRecord")({
  id: Schema.Number,
  messageId: Schema.Number,
  category: Schema.Literals(["notification", "message"]),
  source: Schema.String,
  kind: Schema.NullOr(Schema.String),
  title: Schema.String,
  channel: Schema.String,
  /** E-mail address, or the target id for Teams/Slack channels. */
  recipient: Schema.String,
  status: DeliveryStatus,
  attempts: Schema.Number,
  lastError: Schema.NullOr(Schema.String),
  createdAt: Schema.DateTimeUtc,
  sentAt: Schema.NullOr(Schema.DateTimeUtc),
}) {}

export class DeliveryPage extends Schema.Class<DeliveryPage>("@mosaik/notifications/DeliveryPage")({
  entries: Schema.Array(DeliveryRecord),
  nextCursor: Schema.NullOr(Schema.Number),
}) {}

const targetParams = { id: TargetId }

export class AdminGroup extends HttpApiGroup.make("admin")
  .add(
    HttpApiEndpoint.get("targets", "/targets", { success: Schema.Array(Target) }).annotate(
      RequiredPermission,
      NotificationsAdmin.view,
    ),
    HttpApiEndpoint.post("createTarget", "/targets", {
      payload: CreateTarget,
      success: Target,
      error: [Conflict, BadRequest],
    }).annotate(RequiredPermission, NotificationsAdmin.manage),
    HttpApiEndpoint.patch("updateTarget", "/targets/:id", {
      params: targetParams,
      payload: UpdateTarget,
      success: Target,
      error: [NotFound, BadRequest],
    }).annotate(RequiredPermission, NotificationsAdmin.manage),
    HttpApiEndpoint.delete("deleteTarget", "/targets/:id", {
      params: targetParams,
      success: HttpApiSchema.NoContent,
      error: NotFound,
    }).annotate(RequiredPermission, NotificationsAdmin.manage),
    /** Posts a test message right away and reports the outcome. */
    HttpApiEndpoint.post("testTarget", "/targets/:id/test", {
      params: targetParams,
      success: TestResult,
      error: NotFound,
    }).annotate(RequiredPermission, NotificationsAdmin.manage),
    HttpApiEndpoint.get("routes", "/routes", { success: Schema.Array(RoutingRule) }).annotate(
      RequiredPermission,
      NotificationsAdmin.view,
    ),
    HttpApiEndpoint.put("setRoute", "/routes", {
      payload: Schema.Struct({ key: Schema.String, targets: Schema.Array(TargetId) }),
      success: RoutingRule,
      error: [NotFound, BadRequest],
    }).annotate(RequiredPermission, NotificationsAdmin.manage),
    HttpApiEndpoint.get("deliveries", "/deliveries", {
      query: {
        status: Schema.optional(DeliveryStatus),
        before: Schema.optional(Schema.NumberFromString),
        limit: Schema.optional(Schema.NumberFromString),
      },
      success: DeliveryPage,
    }).annotate(RequiredPermission, NotificationsAdmin.view),
    HttpApiEndpoint.post("retryDelivery", "/deliveries/:id/retry", {
      params: { id: Schema.NumberFromString },
      success: HttpApiSchema.NoContent,
      error: [NotFound, Conflict],
    }).annotate(RequiredPermission, NotificationsAdmin.manage),
  )
  .prefix("/admin") {}

/**
 * Browser API of the notifications service (through the gateway). Endpoints need a
 * logged-in user; admin endpoints also their permission.
 */
export class NotificationsApi extends HttpApi.make("notifications")
  .add(InboxGroup, SettingsGroup, AdminGroup)
  .prefix(NOTIFICATIONS_API_PREFIX)
  .middleware(AccessControl) {}
