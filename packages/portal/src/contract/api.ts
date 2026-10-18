import { HttpApi } from "effect/http-api"
import { AdminGroup } from "./admin"
import { CatalogGroup, DirectoryGroup } from "./catalog"
import { WorkspaceGroup } from "./workspace"

export const PORTAL_WEB_PREFIX = "/api/portal"

/** Browser API of the Portal service (through the gateway). */
export class PortalWebApi extends HttpApi.make("portal-web")
  .add(CatalogGroup, WorkspaceGroup, DirectoryGroup, AdminGroup)
  .prefix(PORTAL_WEB_PREFIX) {}
