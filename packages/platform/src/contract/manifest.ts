import {
  type AnyApp,
  type ConfigSpec,
  ManifestPermission,
  ManifestRole,
  manifestPermissions,
  type NotificationSpec,
  PermissionKey,
  PlatformEventType,
} from "@mosaik/core"
import { NotificationTypeInput } from "@mosaik/notifications/contract"
import { Schema } from "effect"

/**
 * Platform version. Apps declare the major version they were built for; the platform
 * runs only apps of its own major version (rebuild apps on a major upgrade).
 */
export const PLATFORM_VERSION = "0.0.0"
export const PLATFORM_MAJOR = 0

/** Where every app serves its manifest (relative to its base URL). */
export const MANIFEST_PATH = "/.well-known/mosaik-app.json"

export const AppId = Schema.String.check(
  Schema.isPattern(/^[a-z][a-z0-9-]*$/, { message: "An app id (lowercase letters, digits and dashes)" }),
)

export const ConfigSetting = Schema.Struct({
  name: Schema.String.check(Schema.isPattern(/^[A-Z][A-Z0-9_]*$/, { message: "UPPER_SNAKE_CASE" })),
  description: Schema.String,
  required: Schema.Boolean,
  secret: Schema.Boolean,
})
export type ConfigSetting = typeof ConfigSetting.Type

/** The app's browser bundle (an ES module and its styles), served by the app under `/apps/<id>/`. */
export const WebBundle = Schema.Struct({
  /** File names relative to `/apps/<id>/`, content-hashed. */
  entry: Schema.String,
  styles: Schema.Array(Schema.String),
  /** The command palette's search provider (`web/search.ts`), if the app has one. */
  search: Schema.NullOr(Schema.String),
})
export type WebBundle = typeof WebBundle.Type

/** How the Portal lists and runs the app; Core stores it with the manifest but does not use it. */
export class PortalManifest extends Schema.Class<PortalManifest>("@mosaik/platform/PortalManifest")({
  icon: Schema.NullOr(Schema.String),
  /** Where the directory lists the app (its owners and admins can change it). */
  category: Schema.NullOr(Schema.String),
  /** Settings admins enter when the Portal runs the app's image. */
  config: Schema.Array(ConfigSetting),
  /** The browser bundle the shell mounts; `null` for built-in apps (compiled into the shell) and standalone ones. */
  web: Schema.NullOr(WebBundle),
}) {}

/** Everything the platform needs to know about an app, as static JSON (`mosaik-app.json`). */
export class AppManifest extends Schema.Class<AppManifest>("@mosaik/platform/AppManifest")({
  id: AppId,
  name: Schema.String,
  description: Schema.NullOr(Schema.String),
  version: Schema.String,
  /** Platform major version the app was built for. */
  platform: Schema.Number,
  access: PermissionKey,
  /** Includes the owner permission every app has. */
  permissions: Schema.Array(ManifestPermission),
  /** The app's roles, smallest first, then its owner role. */
  roles: Schema.Array(ManifestRole),
  notifications: Schema.Array(NotificationTypeInput),
  /** Platform events the app subscribes to. */
  events: Schema.Array(PlatformEventType),
  database: Schema.Boolean,
  portal: PortalManifest,
}) {}

export const toAppManifest = (app: AnyApp, web: WebBundle | null = null): AppManifest =>
  new AppManifest({
    id: app.id,
    name: app.name,
    description: app.description ?? null,
    version: app.version ?? PLATFORM_VERSION,
    platform: PLATFORM_MAJOR,
    access: app.accessPermission,
    permissions: manifestPermissions(app),
    roles: app.roles,
    notifications: Object.entries<NotificationSpec>(app.notifications ?? {}).map(
      ([name, spec]) =>
        new NotificationTypeInput({
          key: app.notification(name),
          description: spec.description,
          defaultChannels: spec.defaultChannels ?? ["inApp"],
        }),
    ),
    events: app.events,
    database: app.database,
    portal: new PortalManifest({
      icon: app.portal.icon ?? null,
      category: app.portal.category ?? null,
      config: Object.entries<ConfigSpec>(app.portal.config ?? {}).map(([name, spec]) => ({
        name,
        description: spec.description,
        required: spec.required ?? true,
        secret: spec.secret ?? false,
      })),
      web,
    }),
  })
