import { AppMember, RegisteredApp, RoleRef } from "@mosaik/auth/contract"
import {
  AccessControl,
  BadRequest,
  Conflict,
  Forbidden,
  NotFound,
  ownerPermission,
  PermissionKey,
  type Principal,
  PrincipalUser,
  RoleId,
  UserId,
} from "@mosaik/core"
import { Schema } from "effect"
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/http-api"
import { AppId } from "./manifest"

/** Admins who decide who can use every app (and answer the requests of apps without owners). */
export const AccessAdmin = { manage: "admin:users.manage" as PermissionKey }

/** Whether the principal decides who can use the app: one of its owners, or an admin. */
export const canManageApp = (principal: Pick<Principal, "can">, app: string): boolean =>
  principal.can(ownerPermission(app)) || principal.can(AccessAdmin.manage)

/**
 * - `pending`: waiting for an owner or admin
 * - `approved`: the user got a role, or access some other way
 * - `declined`
 */
export const AccessRequestStatus = Schema.Literals(["pending", "approved", "declined"])
export type AccessRequestStatus = typeof AccessRequestStatus.Type

/** Someone asked for access to an app they cannot open. */
export class AccessRequest extends Schema.Class<AccessRequest>("@mosaik/platform/AccessRequest")({
  id: Schema.Number,
  app: Schema.String,
  appName: Schema.String,
  /** The permission that opens the app. */
  access: PermissionKey,
  userId: UserId,
  userName: Schema.String,
  userEmail: Schema.String,
  /** The role they asked for, if they chose one. */
  role: Schema.NullOr(RoleRef),
  message: Schema.NullOr(Schema.String),
  status: AccessRequestStatus,
  createdAt: Schema.DateTimeUtc,
  decidedAt: Schema.NullOr(Schema.DateTimeUtc),
  /** Who answered; `null` when access came some other way. */
  decidedBy: Schema.NullOr(Schema.String),
  /** The role an approval gave. */
  grantedRole: Schema.NullOr(RoleRef),
  /** Why the request was declined. */
  response: Schema.NullOr(Schema.String),
}) {}

const Note = Schema.NullOr(Schema.String.check(Schema.isMaxLength(500)))

/** The current user's access requests. Any logged-in user. */
export class AccessGroup extends HttpApiGroup.make("access")
  .add(
    /** Pending ones, and the ones answered in the last weeks. */
    HttpApiEndpoint.get("mine", "/me/access-requests", { success: Schema.Array(AccessRequest) }),
    /** Asks the app's owners (or the admins) for access. Asking again while a request is pending returns it. */
    HttpApiEndpoint.post("request", "/me/access-requests", {
      payload: Schema.Struct({ app: AppId, role: Schema.NullOr(RoleId), message: Note }),
      success: AccessRequest,
      error: [NotFound, BadRequest],
    }),
  )
  .middleware(AccessControl) {}

/** Requests for the apps the user manages ({@link canManageApp}); admins see every app's. */
export class AccessReviewGroup extends HttpApiGroup.make("accessReview")
  .add(
    HttpApiEndpoint.get("list", "/", {
      query: { status: Schema.optional(AccessRequestStatus), app: Schema.optional(AppId) },
      success: Schema.Array(AccessRequest),
    }),
    /** Gives the user one of the app's roles, then tells them. */
    HttpApiEndpoint.post("approve", "/:id/approve", {
      params: { id: Schema.NumberFromString },
      payload: Schema.Struct({ role: RoleId }),
      success: AccessRequest,
      error: [NotFound, BadRequest, Conflict, Forbidden],
    }),
    HttpApiEndpoint.post("decline", "/:id/decline", {
      params: { id: Schema.NumberFromString },
      payload: Schema.Struct({ reason: Note }),
      success: AccessRequest,
      error: [NotFound, Conflict, Forbidden],
    }),
  )
  .prefix("/access-requests")
  .middleware(AccessControl) {}

/** An app someone decides about (see {@link canManageApp}). */
export class ManagedApp extends Schema.Class<ManagedApp>("@mosaik/platform/ManagedApp")({
  id: Schema.String,
  name: Schema.String,
  description: Schema.NullOr(Schema.String),
}) {}

/** What anyone may know about an app: its roles, and whom to ask for access. */
export class AppAbout extends Schema.Class<AppAbout>("@mosaik/platform/AppAbout")({
  app: RegisteredApp,
  /** Everyone can open it (`anonymous`: even visitors). */
  openTo: Schema.NullOr(Schema.Literals(["anonymous", "authenticated"])),
  owners: Schema.Array(PrincipalUser),
}) {}

const appParams = { id: AppId }

/**
 * Who can use an app: about it for any logged-in user, its members for the people who
 * manage it ({@link canManageApp}).
 */
export class AppsGroup extends HttpApiGroup.make("apps")
  .add(
    /** The apps the caller decides about: the ones they own, or every app for admins. */
    HttpApiEndpoint.get("list", "/apps", { success: Schema.Array(ManagedApp) }),
    HttpApiEndpoint.get("about", "/apps/:id/about", { params: appParams, success: AppAbout, error: NotFound }),
    HttpApiEndpoint.get("members", "/apps/:id/members", {
      params: appParams,
      success: Schema.Array(AppMember),
      error: [NotFound, Forbidden],
    }),
    /** Sets which of the app's roles the user has (none: they lose them); their other roles stay. */
    HttpApiEndpoint.put("setMemberRoles", "/apps/:id/members/:user", {
      params: { ...appParams, user: UserId },
      payload: Schema.Struct({ roles: Schema.Array(RoleId) }),
      success: HttpApiSchema.NoContent,
      error: [NotFound, BadRequest, Forbidden],
    }),
    /** People to give a role to. */
    HttpApiEndpoint.get("people", "/apps/:id/people", {
      params: appParams,
      query: { q: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(100)) },
      success: Schema.Array(PrincipalUser),
      error: Forbidden,
    }),
  )
  .middleware(AccessControl) {}
