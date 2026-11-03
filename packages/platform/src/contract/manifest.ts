import {
  type AnyApp,
  type ConfigSpec,
  ManifestPermission,
  ManifestRole,
  manifestPermissions,
  type NotificationSpec,
  PermissionKey,
  PlatformEventType,
  Setting,
  SettingDeclaration,
  settingProblem,
  toSettingDeclaration,
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
  /** What the form shows; the variable's name when the app gives none. */
  label: Schema.NullOr(Schema.String),
  description: Schema.String,
  /** How the form asks for it and checks it (see `ConfigSpec` in `@mosaik/core`). */
  kind: Schema.Literals(["text", "url", "number", "boolean"]),
  required: Schema.Boolean,
  secret: Schema.Boolean,
})
export type ConfigSetting = typeof ConfigSetting.Type

/**
 * A config entry as a setting, so forms show it with the right field (a number, a switch). Its
 * value stays text in the app's environment: see {@link configFieldValue} and {@link configText}.
 */
export const configAsSetting = (config: ConfigSetting): Setting => {
  const base = { label: config.label ?? config.name, description: config.description }
  switch (config.kind) {
    case "number":
      return Setting.number({ ...base, default: 0 })
    case "boolean":
      return Setting.boolean({ ...base, default: false })
    case "url":
      return Setting.text({ ...base, format: "url", default: "" })
    case "text":
      return Setting.text({ ...base, default: "" })
  }
}

/** The environment's text as the entry's field holds it: a number, `true`/`false`, or the text. */
export const configFieldValue = (config: ConfigSetting, text: string): unknown =>
  config.kind === "number" ? (text === "" ? null : Number(text)) : config.kind === "boolean" ? text === "true" : text

/** A field's value as the environment's text. */
export const configText = (value: unknown): string => (value === null || value === undefined ? "" : String(value))

/** Why `text` is not a value of the entry, if it is not. Empty is not checked here: it means unset. */
export const configProblem = (config: ConfigSetting, text: string): string | undefined => {
  if (text === "") return undefined
  if (config.kind === "boolean") return text === "true" || text === "false" ? undefined : "true or false"
  return settingProblem(configAsSetting(config), configFieldValue(config, text))
}

/** The app's browser bundle (an ES module and its styles), served by the app under `/apps/<id>/`. */
export const WebBundle = Schema.Struct({
  /** File names relative to `/apps/<id>/`, content-hashed. */
  entry: Schema.String,
  styles: Schema.Array(Schema.String),
  /** The command palette's search provider (`web/search.ts`), if the app has one. */
  search: Schema.NullOr(Schema.String),
})
export type WebBundle = typeof WebBundle.Type

/** A page of the app, for navigation (see `PortalPage` in `@mosaik/core`). */
export const PortalPageManifest = Schema.Struct({
  title: Schema.String,
  path: Schema.String,
  /** The name of the app's permission it is listed for (`orders.edit`); `null`: everyone who opens the app. */
  permission: Schema.NullOr(Schema.String),
})
export type PortalPageManifest = typeof PortalPageManifest.Type

/** How the Portal lists and runs the app; Core stores it with the manifest but does not use it. */
export class PortalManifest extends Schema.Class<PortalManifest>("@mosaik/platform/PortalManifest")({
  icon: Schema.NullOr(Schema.String),
  /** Where the directory lists the app (its owners and admins can change it). */
  category: Schema.NullOr(Schema.String),
  /** Settings admins enter when the Portal runs the app's image. */
  config: Schema.Array(ConfigSetting),
  /** The app's pages, in the order navigation lists them. */
  pages: Schema.Array(PortalPageManifest),
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
  /** How the app behaves, changed while it runs by its owners and admins (see `Setting` in `@mosaik/core`). */
  settings: Schema.Array(SettingDeclaration),
  database: Schema.Boolean,
  /** Stores files with the platform. */
  storage: Schema.Boolean,
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
    settings: Object.entries<Setting>(app.settings).map(([name, setting]) => toSettingDeclaration(name, setting)),
    database: app.database,
    storage: app.storage,
    portal: new PortalManifest({
      icon: app.portal.icon ?? null,
      category: app.portal.category ?? null,
      config: Object.entries<ConfigSpec>(app.portal.config ?? {}).map(([name, spec]) => ({
        name,
        label: spec.label ?? null,
        description: spec.description,
        kind: spec.kind ?? "text",
        required: spec.required ?? true,
        secret: spec.secret ?? false,
      })),
      pages: (app.portal.pages ?? []).map((page) => ({
        title: page.title,
        path: page.path,
        permission: page.permission ?? null,
      })),
      web,
    }),
  })
