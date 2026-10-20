/**
 * `@mosaik/sdk`: what an app's manifest and API contract use, on the server and in the browser.
 *
 * The SDK's entry points follow where code runs and which layer it needs:
 * - `@mosaik/sdk` (both), `@mosaik/sdk/server`, `@mosaik/sdk/connectors/*` (server): Core
 * - `@mosaik/sdk/client` (any page), `@mosaik/sdk/solid` (Solid pages), `/ui`, `/table`, `/charts`,
 *   `/css`: Core (Core's console uses the components and the table too)
 * - `@mosaik/sdk/portal` (mounted in the shell): the Portal
 * - `@mosaik/sdk/build/*`: building and running the app; `mosaikApp()` builds for the Portal's
 *   shell or, with `standalone`, Core's own page
 *
 * An app that imports nothing from `@mosaik/sdk/portal` runs without the Portal: only that entry
 * point and the build plugin reach the Portal's code (`bun lint` checks it).
 */
export {
  AccessControl,
  type AnyApp,
  type App,
  type AppSpec,
  BadRequest,
  type ConfigKind,
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
  Setting,
  type SettingsSpec,
  type SettingValue,
  type SettingValues,
  Unauthorized,
  UpstreamError,
  UserId,
} from "@mosaik/core"
export {
  StorageLimitReached,
  StorageUnavailable,
  StoredObject,
  StoredObjectsPage,
  storageKeyProblem,
} from "@mosaik/platform/contract"
