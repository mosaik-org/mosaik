import { AccessControl } from "@mosaik/core"
import { AppId } from "@mosaik/platform/contract"
import { Schema } from "effect"
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/http-api"

/** Most apps a user can pin. */
export const MAX_PINNED_APPS = 50

/** How far back an app counts as in use (directory ranking, admin usage numbers). */
export const ACTIVE_DAYS = 30

/** Where an app is listed in the app directory, e.g. `Sales`. */
export const Category = Schema.String.check(Schema.isTrimmed(), Schema.isMinLength(1), Schema.isMaxLength(40))

/** How often and how recently the user opened an app. */
export class AppUsage extends Schema.Class<AppUsage>("@mosaik/portal/AppUsage")({
  app: Schema.String,
  opens: Schema.Number,
  lastOpenedAt: Schema.DateTimeUtc,
}) {}

/** The current user's apps: what they pinned, and what they use. */
export class MyApps extends Schema.Class<MyApps>("@mosaik/portal/MyApps")({
  /** In the order the user chose. May name apps the user can no longer open. */
  pinned: Schema.Array(Schema.String),
  /** Most recently opened first. */
  usage: Schema.Array(AppUsage),
}) {}

/** How many people use an app (no one's identity). */
export class AppPopularity extends Schema.Class<AppPopularity>("@mosaik/portal/AppPopularity")({
  app: Schema.String,
  /** People who opened the app in the last {@link ACTIVE_DAYS} days. */
  activeUsers: Schema.Number,
}) {}

/** For admins and the app's owners: how much an app is used. */
export class AppUsageStats extends Schema.Class<AppUsageStats>("@mosaik/portal/AppUsageStats")({
  app: Schema.String,
  /** People who opened the app in the last {@link ACTIVE_DAYS} days. */
  activeUsers: Schema.Number,
  /** People who ever opened it. */
  users: Schema.Number,
  opens: Schema.Number,
  lastOpenedAt: Schema.NullOr(Schema.DateTimeUtc),
}) {}

/** The current user's pinned and recently used apps. Any logged-in user. */
export class WorkspaceGroup extends HttpApiGroup.make("workspace")
  .add(
    HttpApiEndpoint.get("apps", "/me/apps", { success: MyApps }),
    /** Replaces the pinned apps (in this order; repeated ids count once). */
    HttpApiEndpoint.put("setPinned", "/me/apps/pinned", {
      payload: Schema.Struct({ apps: Schema.Array(AppId).check(Schema.isMaxLength(MAX_PINNED_APPS)) }),
      success: MyApps,
    }),
    /** The shell reports every time the user goes into an app. */
    HttpApiEndpoint.post("opened", "/me/apps/:id/opened", {
      params: { id: AppId },
      success: HttpApiSchema.NoContent,
    }),
    HttpApiEndpoint.get("popularity", "/apps/popularity", { success: Schema.Array(AppPopularity) }),
  )
  .middleware(AccessControl) {}
