import {
  appOfRole,
  BadRequest,
  ManifestPayload,
  NotFound,
  OWNER_ROLE_NAME,
  PermissionKey,
  PrincipalUser,
  RoleId,
  Unauthorized,
  UserId,
} from "@mosaik/core"
import { Schema } from "effect"
import {
  HttpApi,
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiMiddleware,
  HttpApiSchema,
  HttpApiSecurity,
} from "effect/http-api"

export const INTERNAL_KEY_HEADER = "x-mosaik-internal-key"

/** Service-to-service authentication with a shared secret. Never exposed through the gateway. */
export class InternalAuth extends HttpApiMiddleware.Service<InternalAuth>()("@mosaik/auth/InternalAuth", {
  security: { key: HttpApiSecurity.apiKey({ in: "header", key: INTERNAL_KEY_HEADER }) },
  error: Unauthorized,
  requiredForClient: true,
}) {}

export class IssuedToken extends Schema.Class<IssuedToken>("@mosaik/auth/IssuedToken")({
  token: Schema.String,
  /** Epoch milliseconds. */
  expiresAt: Schema.Number,
  /** Whose token it is; `null` for visitors. */
  userId: Schema.NullOr(UserId),
}) {}

/**
 * Someone's access changed: their roles, or one of their sessions ended. `null`: possibly
 * everyone's (a role's grants changed). Each stream starts with a `null`, since changes
 * made while a listener was away are not replayed.
 */
export class AccessChange extends Schema.Class<AccessChange>("@mosaik/auth/AccessChange")({
  user: Schema.NullOr(UserId),
}) {}

export const ACCESS_STREAM_PATH = "/internal/access/stream"

export class AuditEventInput extends Schema.Class<AuditEventInput>("@mosaik/auth/AuditEventInput")({
  app: Schema.String,
  action: Schema.String,
  target: Schema.NullOr(Schema.String),
  actor: Schema.NullOr(PrincipalUser),
  details: Schema.Record(Schema.String, Schema.Json),
}) {}

export class RolePermission extends Schema.Class<RolePermission>("@mosaik/auth/RolePermission")({
  key: PermissionKey,
  description: Schema.String,
}) {}

/** One of an app's roles, with what it allows. */
export class AppRole extends Schema.Class<AppRole>("@mosaik/auth/AppRole")({
  id: RoleId,
  name: Schema.String,
  description: Schema.NullOr(Schema.String),
  permissions: Schema.Array(RolePermission),
  /** No longer declared by the app: people keep it, nobody new gets it. */
  stale: Schema.Boolean,
}) {
  /** The role of the people who decide who can use the app. */
  get isOwner(): boolean {
    return this.id === `${appOfRole(this.id)}:${OWNER_ROLE_NAME}`
  }
}

/** A registered app, as other services need to know it. */
export class RegisteredApp extends Schema.Class<RegisteredApp>("@mosaik/auth/RegisteredApp")({
  id: Schema.String,
  name: Schema.String,
  /** The permission that opens it. */
  access: PermissionKey,
  /** Its roles, smallest first, the owner role last (stale ones after the others). */
  roles: Schema.Array(AppRole),
}) {}

export class RoleRef extends Schema.Class<RoleRef>("@mosaik/auth/RoleRef")({
  id: RoleId,
  name: Schema.String,
}) {}

/** Someone with one of an app's roles, or with another role that names the app. */
export class AppMember extends Schema.Class<AppMember>("@mosaik/auth/AppMember")({
  user: PrincipalUser,
  /** The app's roles they have. */
  roles: Schema.Array(RoleId),
  /** Other roles that open the app for them, e.g. a team role granting `sales:*`. */
  via: Schema.Array(RoleRef),
  /** Decides who can use the app. */
  owner: Schema.Boolean,
}) {}

/** Who can use an app, and how. */
export class AppAccess extends Schema.Class<AppAccess>("@mosaik/auth/AppAccess")({
  app: RegisteredApp,
  /**
   * When everyone can open the app (`anonymous`: even visitors), so it has no list of
   * people who can; `members` then has only those with more than the access.
   */
  openTo: Schema.NullOr(Schema.Literals(["anonymous", "authenticated"])),
  /** Owners first. Superadmins are not listed: they can do everything everywhere. */
  members: Schema.Array(AppMember),
}) {}

export class InternalGroup extends HttpApiGroup.make("internal")
  .add(
    /** Exchange the browser's cookie header for a short-lived internal token. */
    HttpApiEndpoint.post("issueToken", "/token", {
      payload: Schema.Struct({
        cookie: Schema.NullOr(Schema.String),
        /** The service the token is for (its `aud`). */
        audience: Schema.String,
        /** Only keep grants of this namespace (apps); `null` keeps all (platform services). */
        scope: Schema.NullOr(Schema.String),
      }),
      success: IssuedToken,
    }),
    /** Server-Sent Events of {@link AccessChange}s, for the gateway's token cache. */
    HttpApiEndpoint.get("accessStream", "/access/stream", {
      success: Schema.String.pipe(HttpApiSchema.asText({ contentType: "text/event-stream" })),
    }),
    /** Register (or update) an app manifest and its permissions. */
    HttpApiEndpoint.post("registerApp", "/apps", {
      payload: ManifestPayload,
      success: HttpApiSchema.NoContent,
    }),
    HttpApiEndpoint.get("app", "/apps/:id", {
      params: { id: Schema.String },
      success: RegisteredApp,
      error: NotFound,
    }),
    HttpApiEndpoint.get("appAccess", "/apps/:id/access", {
      params: { id: Schema.String },
      success: AppAccess,
      error: NotFound,
    }),
    /** Sets which of the app's roles a user has; their other roles stay. The caller records the audit entry. */
    HttpApiEndpoint.put("setAppRoles", "/apps/:id/members/:user", {
      params: { id: Schema.String, user: UserId },
      payload: Schema.Struct({ roles: Schema.Array(RoleId) }),
      success: HttpApiSchema.NoContent,
      error: [NotFound, BadRequest],
    }),
    /** Remove an uninstalled app's permissions and the grants in its namespace. */
    HttpApiEndpoint.delete("unregisterApp", "/apps/:id", {
      params: { id: Schema.String },
      success: HttpApiSchema.NoContent,
    }),
    HttpApiEndpoint.post("recordAudit", "/audit", {
      payload: AuditEventInput,
      success: HttpApiSchema.NoContent,
    }),
    /** Contact details of users (e.g. to deliver messages). Unknown ids are left out. */
    HttpApiEndpoint.post("lookupUsers", "/users/lookup", {
      payload: Schema.Struct({ ids: Schema.Array(UserId).check(Schema.isMaxLength(500)) }),
      success: Schema.Array(PrincipalUser),
    }),
    /** Adds a role to a user (who keeps their other roles). The caller records the audit entry. */
    HttpApiEndpoint.post("addRole", "/users/:id/roles", {
      params: { id: UserId },
      payload: Schema.Struct({ role: Schema.String }),
      success: HttpApiSchema.NoContent,
      error: [NotFound, BadRequest],
    }),
    /** Users whose name or e-mail contains the query. */
    HttpApiEndpoint.post("searchUsers", "/users/search", {
      payload: Schema.Struct({ query: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(100)) }),
      success: Schema.Array(PrincipalUser),
    }),
    /**
     * Users holding a permission (through any of their roles, wildcards included), or every
     * user for `null`. `explicit`: only through grants in the permission's app, so not
     * superadmins' `*`.
     */
    HttpApiEndpoint.post("usersWithPermission", "/users/with-permission", {
      payload: Schema.Struct({ permission: Schema.NullOr(Schema.String), explicit: Schema.optional(Schema.Boolean) }),
      success: Schema.Array(PrincipalUser),
    }),
  )
  .middleware(InternalAuth) {}

export class InternalApi extends HttpApi.make("internal").add(InternalGroup).prefix("/internal") {}
