import { InternalAuth } from "@mosaik/auth/contract"
import { BadRequest, Conflict, NotFound } from "@mosaik/core"
import { Schema } from "effect"
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/http-api"
import { AppId, AppManifest } from "./manifest"

/**
 * Where an app's identity comes from:
 * - `configured`: named by the platform's configuration (`CONFIGURED_APPS`), with a key derived
 *   from `INTERNAL_KEY`; it follows the configuration and cannot be removed otherwise
 * - `managed`: created through the registry API (by the Portal), with a key issued once
 */
export const AppOrigin = Schema.Literals(["configured", "managed"])
export type AppOrigin = typeof AppOrigin.Type

/**
 * - `pending`: waiting for the app to register with its key
 * - `active`
 * - `disabled`: its key is refused and the gateway does not route it
 */
export const AppStatus = Schema.Literals(["pending", "active", "disabled"])
export type AppStatus = typeof AppStatus.Type

/** How far an app (or a service) that receives platform events has processed them. */
export class EventConsumer extends Schema.Class<EventConsumer>("@mosaik/platform/EventConsumer")({
  /** Events waiting for it. */
  pending: Schema.Number,
  /** Why the next event could not be handled, if it is stuck. */
  lastError: Schema.NullOr(Schema.String),
  errorAt: Schema.NullOr(Schema.DateTimeUtc),
  /** When it last asked for events. */
  polledAt: Schema.NullOr(Schema.DateTimeUtc),
}) {}

/** An app's identity in Core. */
export class RegistryApp extends Schema.Class<RegistryApp>("@mosaik/platform/RegistryApp")({
  id: Schema.String,
  origin: AppOrigin,
  status: AppStatus,
  /** Where the gateway forwards `/api/<id>/*` and `/apps/<id>/*`; `null` while the app is not running. */
  upstream: Schema.NullOr(Schema.String),
  /** The address a standalone app serves its own page on, as it registered it. */
  publicUrl: Schema.NullOr(Schema.String),
  /** The manifest the app last registered (or the one it was created with). */
  manifest: Schema.NullOr(AppManifest),
  registeredAt: Schema.NullOr(Schema.DateTimeUtc),
  createdAt: Schema.DateTimeUtc,
  /** For apps that subscribe to platform events. */
  events: Schema.NullOr(EventConsumer),
}) {}

export class CreatedApp extends Schema.Class<CreatedApp>("@mosaik/platform/CreatedApp")({
  app: RegistryApp,
  /** Its key (`MOSAIK_APP_KEY`), returned only now. */
  key: Schema.String,
}) {}

export class AppKey extends Schema.Class<AppKey>("@mosaik/platform/AppKey")({ key: Schema.String }) {}

export class AppDatabase extends Schema.Class<AppDatabase>("@mosaik/platform/AppDatabase")({
  /** `DATABASE_URL` for the app, as apps reach the database server (`APP_DB_SERVER_URL`). */
  url: Schema.String,
}) {}

export class RegistryInfo extends Schema.Class<RegistryInfo>("@mosaik/platform/RegistryInfo")({
  /** Whether Core can provision databases for apps. */
  databases: Schema.Boolean,
}) {}

const appParams = { id: Schema.String }

/**
 * App identities for the Portal: it creates the apps it installs, says where they run, and
 * removes them. Removing an app also removes what Core holds for it (permissions, roles,
 * notification types, access requests, event delivery), but never its database.
 */
export class RegistryGroup extends HttpApiGroup.make("registry")
  .add(
    HttpApiEndpoint.get("info", "/", { success: RegistryInfo }),
    HttpApiEndpoint.get("list", "/apps", { success: Schema.Array(RegistryApp) }),
    HttpApiEndpoint.get("get", "/apps/:id", { params: appParams, success: RegistryApp, error: NotFound }),
    /** Creates a `managed` app, `pending` until it registers; events it subscribes to wait for it from now on. */
    HttpApiEndpoint.post("create", "/apps", {
      payload: Schema.Struct({ manifest: AppManifest, upstream: Schema.NullOr(Schema.String) }),
      success: CreatedApp,
      error: [BadRequest, Conflict],
    }),
    HttpApiEndpoint.patch("update", "/apps/:id", {
      params: appParams,
      payload: Schema.Struct({
        upstream: Schema.optional(Schema.NullOr(Schema.String)),
        /** Re-enabling makes the app `pending` again if it never registered. */
        enabled: Schema.optional(Schema.Boolean),
      }),
      success: RegistryApp,
      error: NotFound,
    }),
    /** Applies a manifest as if the app had registered it (e.g. one read again from its address). */
    HttpApiEndpoint.put("register", "/apps/:id/manifest", {
      params: appParams,
      payload: AppManifest,
      success: RegistryApp,
      error: [NotFound, BadRequest],
    }),
    /** Issues a new key; the old one stops working at once. */
    HttpApiEndpoint.post("rotateKey", "/apps/:id/key", {
      params: appParams,
      success: AppKey,
      error: [NotFound, BadRequest],
    }),
    /** Moves the app past the next event it would get (the one it keeps failing on). */
    HttpApiEndpoint.post("skipEvent", "/apps/:id/events/skip", {
      params: appParams,
      success: RegistryApp,
      error: NotFound,
    }),
    HttpApiEndpoint.delete("delete", "/apps/:id", {
      params: appParams,
      success: HttpApiSchema.NoContent,
      error: [NotFound, BadRequest],
    }),
    /** Creates the app's database on Core's server if it does not exist (`mosaik_<id>`). */
    HttpApiEndpoint.post("provisionDatabase", "/databases/:id", {
      params: { id: AppId },
      success: AppDatabase,
      error: BadRequest,
    }),
    HttpApiEndpoint.delete("dropDatabase", "/databases/:id", {
      params: { id: AppId },
      success: HttpApiSchema.NoContent,
      error: BadRequest,
    }),
  )
  .prefix("/registry")
  .middleware(InternalAuth) {}
