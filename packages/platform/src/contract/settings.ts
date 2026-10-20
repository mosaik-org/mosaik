import { AccessControl, BadRequest, Forbidden, NotFound, SettingDeclaration } from "@mosaik/core"
import { Schema } from "effect"
import { HttpApiEndpoint, HttpApiGroup } from "effect/http-api"
import { AppId } from "./manifest"

/** A setting as the people who manage the app see it. */
export class AppSettingState extends Schema.Class<AppSettingState>("@mosaik/platform/AppSettingState")({
  declaration: SettingDeclaration,
  /** What the app reads: the stored value when it fits the declaration, else the default. */
  value: Schema.Json,
  /** Changed from the default (a value is stored), whether or not it still fits. */
  changed: Schema.Boolean,
  /** The stored value no longer fits the declaration (a newer version of the app changed it): the default applies. */
  outdated: Schema.Boolean,
  /** Who last changed it, and when; `null` while it has its default. */
  changedBy: Schema.NullOr(Schema.String),
  changedAt: Schema.NullOr(Schema.DateTimeUtc),
}) {}

/** An app's settings, in the order its manifest declares them. */
export class AppSettings extends Schema.Class<AppSettings>("@mosaik/platform/AppSettings")({
  app: AppId,
  settings: Schema.Array(AppSettingState),
}) {}

/** What changes: values by name, `null` for back to the default. Names left out keep their value. */
export const AppSettingsChange = Schema.Struct({ values: Schema.Record(Schema.String, Schema.NullOr(Schema.Json)) })
export type AppSettingsChange = typeof AppSettingsChange.Type

/** The values an app has, as it reads them (see `Settings` in `@mosaik/server`). */
export class AppSettingsSnapshot extends Schema.Class<AppSettingsSnapshot>("@mosaik/platform/AppSettingsSnapshot")({
  /** Grows with every change: the app asks for what comes after the version it has. */
  version: Schema.Number,
  /** Stored values by name; a setting left out has its default. The app checks them against its own declarations. */
  values: Schema.Record(Schema.String, Schema.Json),
}) {}

const appParams = { id: AppId }

/** An app's settings, for the people who manage it (`canManageApp`): see them and change them. */
export class SettingsGroup extends HttpApiGroup.make("settings")
  .add(
    HttpApiEndpoint.get("get", "/apps/:id/settings", {
      params: appParams,
      success: AppSettings,
      error: [NotFound, Forbidden],
    }),
    /** Applies at once: the app reads the new values while it runs. Recorded in the audit log. */
    HttpApiEndpoint.put("set", "/apps/:id/settings", {
      params: appParams,
      payload: AppSettingsChange,
      success: AppSettings,
      error: [NotFound, Forbidden, BadRequest],
    }),
  )
  .middleware(AccessControl) {}
