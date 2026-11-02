import { BadRequest, NotFound, PlatformEventType, PrincipalUser, Unauthorized } from "@mosaik/core"
import {
  MessageAccepted,
  MessageRequest,
  NotificationAccepted,
  NotificationRequest,
  RateLimited,
} from "@mosaik/notifications/contract"
import { Context, Schema } from "effect"
import {
  HttpApi,
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiMiddleware,
  HttpApiSchema,
  HttpApiSecurity,
} from "effect/http-api"
import { AppManifest } from "./manifest"
import { AppSettingsSnapshot } from "./settings"
import { StorageKey, StorageUnavailable, StoredObject, StoredObjectsPage } from "./storage"

export const PLATFORM_API_PREFIX = "/api/platform/v1"

/** Header carrying an app's key. Not `Authorization`: the gateway sets that to the user's token. */
export const APP_KEY_HEADER = "x-mosaik-app-key"

/** The app making a platform API call, identified by its key. */
export class CurrentApp extends Context.Service<CurrentApp, { readonly id: string }>()("@mosaik/platform/CurrentApp") {}

/** App authentication with its key; every call is attributed to that app. */
export class AppAuth extends HttpApiMiddleware.Service<AppAuth, { provides: CurrentApp }>()(
  "@mosaik/platform/AppAuth",
  {
    security: { key: HttpApiSecurity.apiKey({ in: "header", key: APP_KEY_HEADER }) },
    error: Unauthorized,
    requiredForClient: true,
  },
) {}

export class AppRegistration extends Schema.Class<AppRegistration>("@mosaik/platform/AppRegistration")({
  manifest: AppManifest,
  /**
   * Where a standalone app serves its own page (`MOSAIK_PUBLIC_URL`), `null` for apps the
   * Portal mounts. Sign-in sends people back only to addresses under it.
   */
  publicUrl: Schema.NullOr(
    Schema.String.check(Schema.isPattern(/^https?:\/\/[^\s/]+(\/\S*)?$/, { message: "An http(s) URL" })),
  ),
}) {}

export class AuditRequest extends Schema.Class<AuditRequest>("@mosaik/platform/AuditRequest")({
  action: Schema.String,
  target: Schema.NullOr(Schema.String),
  actor: Schema.NullOr(PrincipalUser),
  /** The AI client the actor used (`Principal.agent`), if any. */
  agent: Schema.NullOr(Schema.String),
  details: Schema.Record(Schema.String, Schema.Json),
}) {}

const { source: _messageSource, ...messageFields } = MessageRequest.fields
const { source: _notificationSource, ...notificationFields } = NotificationRequest.fields

/** A message; its source is the calling app. */
export class AppMessageRequest extends Schema.Class<AppMessageRequest>("@mosaik/platform/AppMessageRequest")(
  messageFields,
) {}

/** A notification; its source is the calling app. */
export class AppNotificationRequest extends Schema.Class<AppNotificationRequest>(
  "@mosaik/platform/AppNotificationRequest",
)(notificationFields) {}

/** A platform event as an app receives it; `data` matches `PlatformEventData[type]`. */
export class AppEvent extends Schema.Class<AppEvent>("@mosaik/platform/AppEvent")({
  /** Unique: an event may be delivered more than once (after a failure), so handle repeats. */
  id: Schema.String,
  /** Position in the event log; acknowledge it once handled. */
  position: Schema.Number,
  type: PlatformEventType,
  occurredAt: Schema.DateTimeUtc,
  data: Schema.Json,
}) {}

export class AppEventBatch extends Schema.Class<AppEventBatch>("@mosaik/platform/AppEventBatch")({
  /** In order. Empty when nothing arrived while waiting. */
  events: Schema.Array(AppEvent),
  /** Events were removed (retention) before the app processed them: resynchronize. */
  missed: Schema.Boolean,
}) {}

/**
 * Where an app stores a file's content (`PUT`, the request body, its `content-type`) and reads it
 * back (`GET`), with `?key=` and the app's key. Streamed both ways, so outside the typed API below;
 * `Storage` in `@mosaik/server` uses them.
 */
export const STORAGE_CONTENT_PATH = `${PLATFORM_API_PREFIX}/storage/content`

/** The longest an events or settings request waits for something new. */
export const MAX_EVENTS_WAIT_SECONDS = 25

/** What apps can ask of the platform. Reachable internally and through the gateway. */
export class AppGroup extends HttpApiGroup.make("app")
  .add(
    /** Register (or update) the calling app's manifest: permissions, roles and notification types. */
    HttpApiEndpoint.put("register", "/register", {
      payload: AppRegistration,
      success: HttpApiSchema.NoContent,
      error: BadRequest,
    }),
    HttpApiEndpoint.post("audit", "/audit", { payload: AuditRequest, success: HttpApiSchema.NoContent }),
    HttpApiEndpoint.post("messages", "/messages", {
      payload: AppMessageRequest,
      success: MessageAccepted,
      error: [BadRequest, RateLimited],
    }),
    HttpApiEndpoint.post("notifications", "/notifications", {
      payload: AppNotificationRequest,
      success: NotificationAccepted,
      error: BadRequest,
    }),
    /**
     * The next events the app subscribed to, after the last position it acknowledged.
     * Waits up to `wait` seconds (at most 25) for new ones.
     */
    HttpApiEndpoint.get("events", "/events", {
      query: { wait: Schema.optional(Schema.NumberFromString) },
      success: AppEventBatch,
      error: BadRequest,
    }),
    /**
     * Marks events up to `position` as handled, or reports why the next one failed
     * (`error`, shown to admins; the position stays).
     */
    HttpApiEndpoint.post("ackEvents", "/events/ack", {
      payload: Schema.Struct({ position: Schema.Number, error: Schema.NullOr(Schema.String) }),
      success: HttpApiSchema.NoContent,
      error: BadRequest,
    }),
    /**
     * The app's settings, once they are newer than the version `after`: at once if they already
     * are (or without `after`), else when they change, or after `wait` seconds (at most 25)
     * with the same version.
     */
    HttpApiEndpoint.get("settings", "/settings", {
      query: { after: Schema.optional(Schema.NumberFromString), wait: Schema.optional(Schema.NumberFromString) },
      success: AppSettingsSnapshot,
    }),
    /** A stored file's size, type and date (its content: {@link STORAGE_CONTENT_PATH}). */
    HttpApiEndpoint.get("storedObject", "/storage/object", {
      query: { key: StorageKey },
      success: StoredObject,
      error: [NotFound, StorageUnavailable],
    }),
    /** Removes a stored file; nothing happens when there is none. */
    HttpApiEndpoint.delete("deleteStoredObject", "/storage/object", {
      query: { key: StorageKey },
      success: HttpApiSchema.NoContent,
      error: StorageUnavailable,
    }),
    /** The app's stored files whose key starts with `prefix`, in key order, a page at a time. */
    HttpApiEndpoint.get("storedObjects", "/storage/objects", {
      query: {
        prefix: Schema.optional(Schema.String),
        after: Schema.optional(Schema.String),
        limit: Schema.optional(Schema.NumberFromString.check(Schema.isBetween({ minimum: 1, maximum: 1000 }))),
      },
      success: StoredObjectsPage,
      error: StorageUnavailable,
    }),
  )
  .middleware(AppAuth) {}

/** Public: keys for verifying the tokens the gateway sends to apps. */
export class KeysGroup extends HttpApiGroup.make("keys").add(
  HttpApiEndpoint.get("jwks", "/jwks.json", { success: Schema.Unknown }),
) {}

export class PlatformApi extends HttpApi.make("platform").add(AppGroup, KeysGroup).prefix(PLATFORM_API_PREFIX) {}

export const JWKS_URL_PATH = `${PLATFORM_API_PREFIX}/jwks.json`
