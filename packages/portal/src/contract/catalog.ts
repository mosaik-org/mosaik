import { AccessControl, Forbidden, PermissionKey } from "@mosaik/core"
import { AppId, PortalPageManifest, WebBundle } from "@mosaik/platform/contract"
import { Schema } from "effect"
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/http-api"
import { AppUsageStats, Category } from "./workspace"

/** An installed app the shell loads at runtime (built-in apps are compiled into the shell). */
export class PublicApp extends Schema.Class<PublicApp>("@mosaik/portal/PublicApp")({
  id: Schema.String,
  name: Schema.String,
  description: Schema.NullOr(Schema.String),
  icon: Schema.NullOr(Schema.String),
  /** Its icon's colour, as its manifest names it (see `appColors` in `@mosaik/core`). */
  color: Schema.NullOr(Schema.String),
  /** The category the app declares. */
  category: Schema.NullOr(Schema.String),
  /** The app's pages, in the order navigation lists them. */
  pages: Schema.Array(PortalPageManifest),
  version: Schema.String,
  access: PermissionKey,
  web: WebBundle,
}) {}

export class Catalog extends Schema.Class<Catalog>("@mosaik/portal/Catalog")({
  apps: Schema.Array(PublicApp),
  /** Categories owners and admins chose, by app id (built-in apps too): they replace the one an app declares. */
  categories: Schema.Record(Schema.String, Schema.String),
}) {}

/** Public: app metadata only, so the shell can build navigation before anyone logs in. */
export class CatalogGroup extends HttpApiGroup.make("catalog").add(
  HttpApiEndpoint.get("apps", "/apps", { success: Catalog }),
) {}

const appParams = { id: AppId }

/** The Portal's part of an app's page, for the people who manage the app (`canManageApp`). */
export class DirectoryGroup extends HttpApiGroup.make("directory")
  .add(
    HttpApiEndpoint.get("usage", "/apps/:id/usage", { params: appParams, success: AppUsageStats, error: Forbidden }),
    /** Where the app directory lists the app; `null` goes back to the app's own category. */
    HttpApiEndpoint.put("setCategory", "/apps/:id/category", {
      params: appParams,
      payload: Schema.Struct({ category: Schema.NullOr(Category) }),
      success: HttpApiSchema.NoContent,
      error: Forbidden,
    }),
  )
  .middleware(AccessControl) {}
