import { CustomRoleId, Grant, PermissionKey, PrincipalUser, RoleId, UserId } from "@mosaik/core"
import { Schema } from "effect"

export class AdminUser extends Schema.Class<AdminUser>("@mosaik/auth/admin/AdminUser")({
  id: UserId,
  email: Schema.String,
  name: Schema.String,
  image: Schema.NullOr(Schema.String),
  roles: Schema.Array(RoleId),
  /** Sign-in methods linked to the account, e.g. `credential`, `microsoft`. */
  providers: Schema.Array(Schema.String),
  createdAt: Schema.DateTimeUtc,
}) {}

export class CreateUser extends Schema.Class<CreateUser>("@mosaik/auth/admin/CreateUser")({
  email: Schema.String.check(Schema.isPattern(/^[^\s@]+@[^\s@]+$/, { message: "Invalid email address" })),
  name: Schema.String.check(Schema.isMinLength(1, { message: "Enter a name" })),
  password: Schema.String.check(Schema.isMinLength(8, { message: "At least 8 characters" })),
  roles: Schema.Array(RoleId),
}) {}

export class Role extends Schema.Class<Role>("@mosaik/auth/admin/Role")({
  id: RoleId,
  name: Schema.String,
  description: Schema.NullOr(Schema.String),
  builtIn: Schema.Boolean,
  /** The app that declares the role (and its grants); `null` for roles admins create. */
  app: Schema.NullOr(Schema.String),
  appName: Schema.NullOr(Schema.String),
  /** The app no longer declares it. */
  stale: Schema.Boolean,
  grants: Schema.Array(Grant),
  userCount: Schema.Int,
}) {}

export class CreateRole extends Schema.Class<CreateRole>("@mosaik/auth/admin/CreateRole")({
  id: CustomRoleId,
  name: Schema.String.check(Schema.isMinLength(1, { message: "Enter a name" })),
  description: Schema.NullOr(Schema.String),
}) {}

export class UpdateRole extends Schema.Class<UpdateRole>("@mosaik/auth/admin/UpdateRole")({
  name: Schema.String.check(Schema.isMinLength(1, { message: "Enter a name" })),
  description: Schema.NullOr(Schema.String),
}) {}

export class CatalogPermission extends Schema.Class<CatalogPermission>("@mosaik/auth/admin/CatalogPermission")({
  key: PermissionKey,
  description: Schema.String,
  dangerous: Schema.Boolean,
  /** No longer declared by the app's manifest. Kept so role settings survive bad deploys. */
  stale: Schema.Boolean,
}) {}

export class CatalogApp extends Schema.Class<CatalogApp>("@mosaik/auth/admin/CatalogApp")({
  id: Schema.String,
  name: Schema.String,
  description: Schema.NullOr(Schema.String),
  access: PermissionKey,
  permissions: Schema.Array(CatalogPermission),
  registeredAt: Schema.DateTimeUtc,
}) {}

export class AuditRecord extends Schema.Class<AuditRecord>("@mosaik/auth/admin/AuditRecord")({
  id: Schema.Int,
  at: Schema.DateTimeUtc,
  app: Schema.String,
  action: Schema.String,
  target: Schema.NullOr(Schema.String),
  actorId: Schema.NullOr(Schema.String),
  actorEmail: Schema.NullOr(Schema.String),
  /** The AI client the actor used, if any. */
  agent: Schema.NullOr(Schema.String),
  details: Schema.Record(Schema.String, Schema.Json),
}) {}

/** An AI client someone connected to Mosaik's MCP server (see `@mosaik/auth/contract`'s agent paths). */
export class AgentConnection extends Schema.Class<AgentConnection>("@mosaik/auth/admin/AgentConnection")({
  id: Schema.String,
  user: PrincipalUser,
  /** The client's name, as it registered or published it. */
  client: Schema.String,
  /** Its client id: the address of its metadata document, or the id it registered under. */
  clientId: Schema.String,
  createdAt: Schema.DateTimeUtc,
  lastUsedAt: Schema.DateTimeUtc,
}) {}

export class AuditPage extends Schema.Class<AuditPage>("@mosaik/auth/admin/AuditPage")({
  entries: Schema.Array(AuditRecord),
  /** Pass as `before` to load the next page; `null` when there are no more entries. */
  nextCursor: Schema.NullOr(Schema.Int),
}) {}
