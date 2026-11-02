import { AccessControl, BadRequest, Conflict, NotFound, RequiredPermission, RoleId, UserId } from "@mosaik/core"
import { Schema } from "effect"
import { HttpApi, HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/http-api"
import { AdminUser, AgentConnection, AuditPage, CatalogApp, CreateRole, CreateUser, Role, UpdateRole } from "./domain"
import { admin } from "./manifest"

const userParams = { id: UserId }
const roleParams = { id: RoleId }

export class UsersGroup extends HttpApiGroup.make("users")
  .add(
    HttpApiEndpoint.get("list", "/", { success: Schema.Array(AdminUser) }),
    HttpApiEndpoint.post("create", "/", { payload: CreateUser, success: AdminUser, error: [Conflict, BadRequest] }),
    HttpApiEndpoint.put("setRoles", "/:id/roles", {
      params: userParams,
      payload: Schema.Struct({ roles: Schema.Array(RoleId) }),
      success: AdminUser,
      error: [NotFound, BadRequest],
    }),
    HttpApiEndpoint.delete("delete", "/:id", {
      params: userParams,
      success: HttpApiSchema.NoContent,
      error: [NotFound, BadRequest],
    }),
  )
  .annotateEndpoints(RequiredPermission, admin.perm("users.manage"))
  .prefix("/users") {}

const manageRoles = admin.perm("roles.manage")

export class RolesGroup extends HttpApiGroup.make("roles")
  .add(
    // Listing roles only needs `admin:access`: user management assigns roles too.
    HttpApiEndpoint.get("list", "/", { success: Schema.Array(Role) }),
    HttpApiEndpoint.post("create", "/", { payload: CreateRole, success: Role, error: Conflict }).annotate(
      RequiredPermission,
      manageRoles,
    ),
    HttpApiEndpoint.patch("update", "/:id", {
      params: roleParams,
      payload: UpdateRole,
      success: Role,
      error: [NotFound, BadRequest],
    }).annotate(RequiredPermission, manageRoles),
    HttpApiEndpoint.put("setGrants", "/:id/grants", {
      params: roleParams,
      payload: Schema.Struct({ grants: Role.fields.grants }),
      success: Role,
      error: [NotFound, BadRequest],
    }).annotate(RequiredPermission, manageRoles),
    HttpApiEndpoint.delete("delete", "/:id", {
      params: roleParams,
      success: HttpApiSchema.NoContent,
      error: [NotFound, BadRequest],
    }).annotate(RequiredPermission, manageRoles),
  )
  .prefix("/roles") {}

export class CatalogGroup extends HttpApiGroup.make("catalog")
  .add(HttpApiEndpoint.get("list", "/", { success: Schema.Array(CatalogApp) }))
  .prefix("/catalog") {}

export class AuditGroup extends HttpApiGroup.make("audit")
  .add(
    HttpApiEndpoint.get("list", "/", {
      query: {
        app: Schema.optional(Schema.String),
        before: Schema.optional(Schema.NumberFromString),
        limit: Schema.optional(Schema.NumberFromString),
      },
      success: AuditPage,
    }),
  )
  .annotateEndpoints(RequiredPermission, admin.perm("audit.view"))
  .prefix("/audit") {}

/** AI clients people connected to Mosaik's MCP server: who connected what, and disconnecting them. */
export class AgentsGroup extends HttpApiGroup.make("agents")
  .add(
    HttpApiEndpoint.get("list", "/", { success: Schema.Array(AgentConnection) }),
    HttpApiEndpoint.delete("disconnect", "/:id", {
      params: { id: Schema.String },
      success: HttpApiSchema.NoContent,
      error: NotFound,
    }),
  )
  .annotateEndpoints(RequiredPermission, admin.perm("users.manage"))
  .prefix("/agents") {}

/** Core's administration API, served by the auth service under `/api/admin`. */
export class AdminApi extends HttpApi.make("admin")
  .add(UsersGroup, RolesGroup, CatalogGroup, AuditGroup, AgentsGroup)
  .prefix(admin.apiPrefix)
  .middleware(AccessControl) {}
