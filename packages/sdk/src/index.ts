/**
 * `@mosaik/sdk`: what an app's manifest and API contract use, on the server and in the browser.
 *
 * The SDK is two packages. This one is what every app builds on, with none of Mosaik's UI (`bun lint`
 * checks it), so a team can bring its own; `@mosaik/web-sdk` is Mosaik's UI on top of it. Entry points
 * follow where code runs:
 * - `@mosaik/sdk` (both), `@mosaik/sdk/server`, `@mosaik/sdk/connectors/*` (server)
 * - `@mosaik/sdk/client` (any page), `@mosaik/sdk/solid` (Solid pages), `@mosaik/sdk/router` (pages on
 *   TanStack Router)
 * - `@mosaik/sdk/build/dev`, `/build/manifest`: running the app and describing it to the platform
 *
 * All of it is Core: an app needs the Portal only through `@mosaik/web-sdk/portal` and the build plugin.
 */
export {
  AccessControl,
  AgentTool,
  type AgentToolSpec,
  type AnyApp,
  type App,
  type AppColor,
  type AppSpec,
  appColors,
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
  StatusAudience,
  StatusAudiences,
  type StatusesSpec,
  StatusKind,
  type StatusSpec,
  StatusTone,
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
