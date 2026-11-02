import { Context, Effect } from "effect"
import { HttpApiMiddleware, HttpApiSecurity } from "effect/http-api"
import { Forbidden, Unauthorized } from "./errors"
import type { PermissionKey } from "./permission"
import type { Principal } from "./principal"

/** The principal of the current request, provided by {@link AccessControl}. */
export class CurrentPrincipal extends Context.Service<CurrentPrincipal, Principal>()("@mosaik/core/CurrentPrincipal") {}

/**
 * Endpoint / group annotation with the permission an endpoint requires.
 * Endpoints without it require the app's `access` permission.
 *
 * @example
 * HttpApiEndpoint.post("refund", "/orders/:id/refund", { ... })
 *   .annotate(RequiredPermission, sales.perm("orders.refund"))
 */
export class RequiredPermission extends Context.Service<RequiredPermission, PermissionKey>()(
  "@mosaik/core/RequiredPermission",
) {}

/** How an endpoint is offered to AI clients (see {@link AgentTool}). */
export interface AgentToolSpec {
  /**
   * What the tool does and when to use it, for the AI that chooses it: "Refund a paid or shipped
   * order; the customer gets the money back". Say what the inputs mean when their names do not.
   */
  readonly description: string
  /** A short name people read in their AI client, e.g. "Refund an order". Defaults to the endpoint's name. */
  readonly title?: string
}

/**
 * Endpoint annotation offering the endpoint to AI clients, as a tool of Mosaik's MCP server.
 * People's AI clients see the tools of the endpoints they may call, and calls run as them:
 * the same permission checks, the same audit log. Endpoints without it are not offered.
 *
 * @example
 * HttpApiEndpoint.post("refund", "/orders/:id/refund", { ... })
 *   .annotate(RequiredPermission, sales.perm("orders.refund"))
 *   .annotate(AgentTool, { description: "Refund a paid or shipped order; the customer gets the money back" })
 */
export class AgentTool extends Context.Service<AgentTool, AgentToolSpec>()("@mosaik/core/AgentTool") {}

/**
 * Verifies the internal token the gateway attaches to every request and enforces
 * the endpoint's {@link RequiredPermission}. Add it to every app API:
 *
 * @example
 * class SalesApi extends HttpApi.make("sales").add(Orders).prefix(sales.apiPrefix).middleware(AccessControl) {}
 */
export class AccessControl extends HttpApiMiddleware.Service<AccessControl, { provides: CurrentPrincipal }>()(
  "@mosaik/core/AccessControl",
  {
    security: { bearer: HttpApiSecurity.bearer },
    error: [Unauthorized, Forbidden],
  },
) {}

/**
 * Imperative permission check for handlers that need finer-grained decisions than
 * the endpoint annotation (the endpoint must declare `Forbidden` as an error).
 */
export const requirePermission = Effect.fnUntraced(function* (permission: PermissionKey) {
  const principal = yield* CurrentPrincipal
  if (!principal.can(permission)) {
    return yield* new Forbidden({ permission })
  }
  return principal
})
