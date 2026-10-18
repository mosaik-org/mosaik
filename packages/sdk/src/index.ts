/**
 * `@mosaik/sdk`: what an app's manifest and API contract use, on the server and in the browser.
 *
 * The SDK's entry points follow where code runs and which layer it needs:
 * - `@mosaik/sdk` (both), `@mosaik/sdk/server`, `@mosaik/sdk/connectors/*` (server): Core
 * - `@mosaik/sdk/client` (any page), `@mosaik/sdk/solid` (Solid pages): Core
 * - `@mosaik/sdk/portal` (mounted in the shell), `@mosaik/sdk/ui`, `/table`, `/charts`, `/css`: the Portal
 * - `@mosaik/sdk/build/*`: building and running the app
 *
 * An app that imports nothing from `@mosaik/sdk/portal` runs without the Portal.
 */
export {
  AccessControl,
  type AnyApp,
  type App,
  type AppSpec,
  BadRequest,
  type ConfigSpec,
  Conflict,
  CurrentPrincipal,
  defineApp,
  Forbidden,
  Fresh,
  fresh,
  Grant,
  isFresh,
  isGranted,
  NotFound,
  type NotificationKey,
  type NotificationSpec,
  PermissionKey,
  type PermissionSpec,
  PersonalChannel,
  PLATFORM_EVENT_DESCRIPTIONS,
  PlatformEventData,
  PlatformEventType,
  type PortalSpec,
  Principal,
  PrincipalUser,
  RequiredPermission,
  RoleId,
  type RoleSpec,
  requirePermission,
  Unauthorized,
  UpstreamError,
  UserId,
} from "@mosaik/core"
