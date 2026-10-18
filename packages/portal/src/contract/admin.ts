import { AccessControl, BadRequest, Conflict, NotFound, RequiredPermission } from "@mosaik/core"
import { AppKey, AppManifest, EventConsumer } from "@mosaik/platform/contract"
import { Schema } from "effect"
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/http-api"
import { AppsAdmin } from "./identity"
import { AppUsageStats } from "./workspace"

/** Environment variables the Portal sets itself for apps it runs; apps cannot declare them as config. */
export const RESERVED_ENV: ReadonlySet<string> = new Set([
  "PORT",
  "PLATFORM_URL",
  "MOSAIK_APP_KEY",
  "DATABASE_URL",
  "NODE_ENV",
  "INTERNAL_KEY",
])

/**
 * - `configured`: named by Core's configuration (built-in apps with a backend, and the examples
 *   in development): it follows the configuration, so the Portal cannot uninstall it
 * - `remote`: hosted elsewhere, installed by its URL
 * - `image`: a Docker image the Portal runs
 */
export const AppKind = Schema.Literals(["configured", "remote", "image"])
export type AppKind = typeof AppKind.Type

/**
 * - `pending`: waiting for the app to register with its key
 * - `deploying`: the Portal is pulling and starting the image
 * - `active`, `failed`, `disabled`
 */
export const InstallStatus = Schema.Literals(["pending", "deploying", "active", "failed", "disabled"])
export type InstallStatus = typeof InstallStatus.Type

export const AppHealth = Schema.Literals(["unknown", "healthy", "unhealthy"])
export type AppHealth = typeof AppHealth.Type

/** Where an image app's database comes from: none, provisioned by Core, or its own (`DATABASE_URL` in config). */
export const DatabaseMode = Schema.Literals(["none", "platform", "app"])
export type DatabaseMode = typeof DatabaseMode.Type

export class ConfigValue extends Schema.Class<ConfigValue>("@mosaik/portal/ConfigValue")({
  name: Schema.String,
  description: Schema.String,
  required: Schema.Boolean,
  secret: Schema.Boolean,
  /** Whether a value is stored. */
  set: Schema.Boolean,
  /** The value, for settings that are not secret. */
  value: Schema.NullOr(Schema.String),
}) {}

export class AdminApp extends Schema.Class<AdminApp>("@mosaik/portal/AdminApp")({
  id: Schema.String,
  kind: AppKind,
  name: Schema.String,
  version: Schema.NullOr(Schema.String),
  status: InstallStatus,
  /** Why the app failed, or what is happening while it deploys. */
  statusMessage: Schema.NullOr(Schema.String),
  health: AppHealth,
  /** Base URL of a remote app. */
  url: Schema.NullOr(Schema.String),
  /** Image reference of an image app, and the digest it runs. */
  image: Schema.NullOr(Schema.String),
  digest: Schema.NullOr(Schema.String),
  /** What a rollback goes back to. */
  previousImage: Schema.NullOr(Schema.String),
  database: DatabaseMode,
  config: Schema.Array(ConfigValue),
  manifest: Schema.NullOr(AppManifest),
  createdAt: Schema.DateTimeUtc,
  registeredAt: Schema.NullOr(Schema.DateTimeUtc),
  lastSeenAt: Schema.NullOr(Schema.DateTimeUtc),
  /** For apps that subscribe to platform events. */
  events: Schema.NullOr(EventConsumer),
}) {}

export const AppSource = Schema.TaggedUnion({
  /** An app hosted elsewhere; its manifest is read from `<url>/.well-known/mosaik-app.json`. */
  Url: { url: Schema.String.check(Schema.isPattern(/^https?:\/\/\S+$/, { message: "An http(s) URL" })) },
  /** A Docker image the platform runs, e.g. `registry.example.com/team/crm:1.4.2`. */
  Image: { image: Schema.String.check(Schema.isPattern(/^\S+$/, { message: "An image reference" })) },
})
export type AppSource = typeof AppSource.Type

/** What installing would do: the manifest, and anything that prevents it. */
export class Inspection extends Schema.Class<Inspection>("@mosaik/portal/Inspection")({
  /** `pulling` while a large image downloads: ask again. */
  state: Schema.Literals(["pulling", "ready", "failed"]),
  manifest: Schema.NullOr(AppManifest),
  digest: Schema.NullOr(Schema.String),
  error: Schema.NullOr(Schema.String),
  /** Reasons the app cannot be installed (e.g. built for another platform version, or the id is taken). */
  problems: Schema.Array(Schema.String),
}) {}

export class InstallRequest extends Schema.Class<InstallRequest>("@mosaik/portal/InstallRequest")({
  source: AppSource,
  /** Image apps that need a database: `platform` (provisioned by Core) or `app` (`DATABASE_URL` in config). */
  database: DatabaseMode,
  config: Schema.Record(Schema.String, Schema.String),
}) {}

export class Installed extends Schema.Class<Installed>("@mosaik/portal/Installed")({
  app: AdminApp,
  /** For remote apps: their key, shown only now (`MOSAIK_APP_KEY`). */
  key: Schema.NullOr(Schema.String),
}) {}

export class AppLogs extends Schema.Class<AppLogs>("@mosaik/portal/AppLogs")({ lines: Schema.String }) {}

export class RegistryCredential extends Schema.Class<RegistryCredential>("@mosaik/portal/RegistryCredential")({
  /** Registry host, e.g. `registry.example.com` or `localhost:5000`. */
  server: Schema.String,
  username: Schema.String,
  createdAt: Schema.DateTimeUtc,
}) {}

const appParams = { id: Schema.String }

export class AdminGroup extends HttpApiGroup.make("admin")
  .add(
    HttpApiEndpoint.get("apps", "/apps", { success: Schema.Array(AdminApp) }),
    /** Reads the manifest of an app before installing it (pulling the image if needed). */
    HttpApiEndpoint.post("inspect", "/apps/inspect", {
      payload: Schema.Struct({ source: AppSource }),
      success: Inspection,
      error: BadRequest,
    }),
    HttpApiEndpoint.post("install", "/apps", {
      payload: InstallRequest,
      success: Installed,
      error: [BadRequest, Conflict],
    }),
    HttpApiEndpoint.post("upgrade", "/apps/:id/upgrade", {
      params: appParams,
      payload: Schema.Struct({ image: AppSource.cases.Image.fields.image }),
      success: AdminApp,
      error: [NotFound, BadRequest, Conflict],
    }),
    HttpApiEndpoint.post("rollback", "/apps/:id/rollback", {
      params: appParams,
      success: AdminApp,
      error: [NotFound, BadRequest, Conflict],
    }),
    HttpApiEndpoint.post("restart", "/apps/:id/restart", {
      params: appParams,
      success: AdminApp,
      error: [NotFound, BadRequest, Conflict],
    }),
    HttpApiEndpoint.post("disable", "/apps/:id/disable", {
      params: appParams,
      success: AdminApp,
      error: [NotFound, BadRequest],
    }),
    HttpApiEndpoint.post("enable", "/apps/:id/enable", {
      params: appParams,
      success: AdminApp,
      error: [NotFound, BadRequest, Conflict],
    }),
    /** Changes config; an empty value keeps a stored secret. Image apps are restarted. */
    HttpApiEndpoint.put("setConfig", "/apps/:id/config", {
      params: appParams,
      payload: Schema.Struct({ values: Schema.Record(Schema.String, Schema.String) }),
      success: AdminApp,
      error: [NotFound, BadRequest, Conflict],
    }),
    /** Issues a new key; the old one stops working (an image app restarts with the new one). */
    HttpApiEndpoint.post("rotateKey", "/apps/:id/key", {
      params: appParams,
      success: AppKey,
      error: [NotFound, BadRequest],
    }),
    /** Reads a remote app's manifest again. */
    HttpApiEndpoint.post("refresh", "/apps/:id/refresh", {
      params: appParams,
      success: AdminApp,
      error: [NotFound, BadRequest],
    }),
    /** Skips the next event the app would get: the one it keeps failing on. */
    HttpApiEndpoint.post("skipEvents", "/apps/:id/events/skip", {
      params: appParams,
      success: AdminApp,
      error: [NotFound, BadRequest],
    }),
    HttpApiEndpoint.get("logs", "/apps/:id/logs", {
      params: appParams,
      query: { tail: Schema.optional(Schema.NumberFromString) },
      success: AppLogs,
      error: [NotFound, BadRequest],
    }),
    HttpApiEndpoint.delete("uninstall", "/apps/:id", {
      params: appParams,
      query: { deleteData: Schema.optional(Schema.Literals(["true", "false"])) },
      success: HttpApiSchema.NoContent,
      error: [NotFound, BadRequest],
    }),
    /** How much every app that was ever opened is used. */
    HttpApiEndpoint.get("usage", "/usage", { success: Schema.Array(AppUsageStats) }),
    HttpApiEndpoint.get("registries", "/registries", { success: Schema.Array(RegistryCredential) }),
    HttpApiEndpoint.put("setRegistry", "/registries", {
      payload: Schema.Struct({
        server: Schema.String.check(Schema.isPattern(/^[a-z0-9.-]+(:\d+)?$/, { message: "A registry host" })),
        username: Schema.String.check(Schema.isMinLength(1)),
        password: Schema.String.check(Schema.isMinLength(1)),
      }),
      success: RegistryCredential,
    }),
    HttpApiEndpoint.delete("deleteRegistry", "/registries", {
      query: { server: Schema.String },
      success: HttpApiSchema.NoContent,
      error: NotFound,
    }),
  )
  .annotateEndpoints(RequiredPermission, AppsAdmin.manage)
  .prefix("/admin")
  .middleware(AccessControl) {}
