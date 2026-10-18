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
