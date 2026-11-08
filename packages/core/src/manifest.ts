import { Schema } from "effect"
import type { PlatformEventType } from "./events"
import { AppIdPattern, PermissionKey, PermissionNamePattern } from "./permission"
import {
  appRoleId,
  expandRoleGrants,
  ManifestRole,
  MEMBER_ROLE_NAME,
  OWNER_PERMISSION_NAME,
  OWNER_ROLE_NAME,
  ownerPermission,
  RoleNamePattern,
  type RoleSpec,
} from "./roles"
import { type NoSettings, SettingNamePattern, type SettingsSpec, settingProblem } from "./settings"
import type { NoStatuses, StatusesSpec, StatusKey, StatusSpec } from "./status"

export interface PermissionSpec {
  readonly description: string
  /**
   * Roles that receive this permission when it is registered for the first time.
   * Later changes are owned by the admin panel and never overwritten.
   */
  readonly defaultRoles?: ReadonlyArray<string>
  /** Highlighted in the admin panel (destructive or sensitive actions). */
  readonly dangerous?: boolean
}

/** Channels a user can receive their notifications on (each user chooses per notification type). */
export const PersonalChannel = Schema.Literals(["inApp", "email", "slack"])
export type PersonalChannel = typeof PersonalChannel.Type

/**
 * Who may resolve an action item: the person too (`anyone`), for work done outside Mosaik, or the app
 * alone (`app`), where "resolved" must be true, such as an approval still pending.
 */
export const NotificationResolver = Schema.Literals(["anyone", "app"])
export type NotificationResolver = typeof NotificationResolver.Type

export interface NotificationSpec {
  /** Shown in notification settings, e.g. "An order was refunded". */
  readonly description: string
  /**
   * Channels used until a user changes their settings. Defaults to `["inApp"]`.
   * Admins can additionally route a type to Teams or Slack channels.
   */
  readonly defaultChannels?: ReadonlyArray<PersonalChannel>
  /**
   * It asks something of the person: its items stay open in their inbox, counting on the bell, until
   * they are resolved. Every notification of it needs a `subject`, which the app resolves it by.
   * Otherwise it is information, which opening marks read and *Done* clears.
   */
  readonly action?: boolean
  /** Who may resolve its items (an action's only): `anyone` by default, or the `app` alone. */
  readonly resolvedBy?: NotificationResolver
}

export type NotificationKey<Id extends string = string, Name extends string = string> = `${Id}:${Name}`

/**
 * A setting the app reads from its environment (e.g. `JIRA_URL`). For apps the Portal
 * runs, admins fill them in at install; secrets are stored encrypted and never shown again.
 * For where things are and credentials; how the app behaves is a setting (`settings`), changed
 * while it runs.
 */
export interface ConfigSpec {
  /** What the form shows, e.g. "Jira address". Defaults to the variable's name. */
  readonly label?: string
  readonly description: string
  /**
   * How the form asks for it and checks it; the app still reads text from its environment
   * (`true`/`false` for `boolean`). Defaults to `text`.
   */
  readonly kind?: ConfigKind
  /** Defaults to `true`. */
  readonly required?: boolean
  /** Defaults to `false`. */
  readonly secret?: boolean
}

export type ConfigKind = "text" | "url" | "number" | "boolean"

/**
 * A page of the app, for navigation: the shell's sidebar lists an app's pages under it while it is
 * open; where nothing lists them (Core's console), `AppLayout` shows them as tabs.
 */
export interface PortalPage<Permission extends string = string> {
  /** What navigation calls it, e.g. `Orders`. */
  readonly title: string
  /** Its address under the app's: `/` for the app's first page, `/orders` for `/<id>/orders`. */
  readonly path: string
  /** Listed only for people with this permission of the app, e.g. `orders.edit` (the page is theirs only). */
  readonly permission?: Permission
}

/**
 * The colours an app's icon can take, so that apps tell apart at a glance while the interface
 * around them stays grey. Each is one of the theme's palettes.
 */
export const appColors = ["amber", "blue", "green", "indigo", "orange", "pink", "teal", "violet"] as const

export type AppColor = (typeof appColors)[number]

/** Whether a name (from a manifest another app built) is one of {@link appColors}. */
export const isAppColor = (name: string | null | undefined): name is AppColor =>
  (appColors as ReadonlyArray<string | null | undefined>).includes(name)

/**
 * A colour picked from an id, so that whatever has none of its own keeps one wherever and whenever
 * it shows. A small string hash (FNV-1a): stable across sessions and browsers.
 */
export const colorOf = (id: string): AppColor => {
  let hash = 0x811c9dc5
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return appColors[(hash >>> 0) % appColors.length] ?? "blue"
}

/**
 * How the Portal lists and runs the app. Core's services ignore it; a standalone app (on its own
 * address, without the Portal) leaves it out.
 */
export interface PortalSpec<Permission extends string = string> {
  /** Name of a lucide icon, e.g. `chart-line`. */
  readonly icon?: string
  /** Its icon's colour, e.g. `teal`; without one, a colour picked from the app's id (the same each time). */
  readonly color?: AppColor
  /** Where the directory lists the app, e.g. `Sales` (its owners and admins can change it). */
  readonly category?: string
  /** Environment variables admins enter when the Portal runs the app's image, keyed by name (e.g. `JIRA_URL`). */
  readonly config?: { readonly [name: string]: ConfigSpec }
  /** The app's pages, in the order navigation lists them. An app of one page leaves them out. */
  readonly pages?: ReadonlyArray<PortalPage<Permission>>
}

export interface AppSpec<
  Id extends string,
  Name extends string,
  Notification extends string = never,
  Event extends PlatformEventType = never,
  Settings extends SettingsSpec = NoSettings,
  Statuses extends StatusesSpec = NoStatuses,
> {
  /** URL segment, API prefix and permission namespace. */
  readonly id: Id
  readonly name: string
  /** The app's own version (semver). Built-in apps default to the platform version. */
  readonly version?: string
  readonly description?: string
  /** Permission needed to see the app. Also the default for every API endpoint. */
  readonly access: NoInfer<Name>
  readonly permissions: { readonly [K in Name]: PermissionSpec }
  /**
   * Roles admins and the app's owners give people, smallest first, e.g.
   * `{ editor: { name: "Editor", grants: ["orders.*"] } }`. Each includes `access`.
   * Without any, the app gets a `member` role that only opens it. Every app also gets an
   * `owner` role, for the people who decide who can use it.
   */
  readonly roles?: { readonly [role: string]: RoleSpec<NoInfer<Name>> }
  /** Notification types this app sends (see `Notify` in `@mosaik/server`). */
  readonly notifications?: { readonly [K in Notification]: NotificationSpec }
  /** Platform events the app receives (see `Events` in `@mosaik/server`). */
  readonly events?: ReadonlyArray<Event>
  /**
   * How the app behaves, changed by its owners and admins while it runs, by name: declare them
   * with `Setting` and read them with `Settings` in `@mosaik/server`.
   */
  readonly settings?: Settings
  /**
   * What the app tells people about itself beside its name in navigation, by name: things waiting
   * for them, something new, work running, trouble. Set them with `Status` in `@mosaik/server`.
   */
  readonly statuses?: Statuses
  /** Needs a Postgres database (`DATABASE_URL`): provisioned by the platform, or the app's own. */
  readonly database?: boolean
  /** Stores files with the platform (see `Storage` in `@mosaik/server`), within a limit admins set. */
  readonly storage?: boolean
  /** Whether the app runs its own backend process. Defaults to `true`. */
  readonly backend?: boolean
  /** How the Portal lists and runs the app (see {@link PortalSpec}). */
  readonly portal?: PortalSpec<NoInfer<Name>>
}

const AppTypeId: unique symbol = Symbol.for("@mosaik/core/App")

export interface App<
  Id extends string = string,
  Name extends string = string,
  Notification extends string = string,
  Event extends PlatformEventType = PlatformEventType,
  Settings extends SettingsSpec = SettingsSpec,
  Statuses extends StatusesSpec = StatusesSpec,
> extends Omit<
    AppSpec<Id, Name, Notification, Event, Settings, Statuses>,
    "roles" | "portal" | "settings" | "statuses"
  > {
  readonly [AppTypeId]: typeof AppTypeId
  readonly portal: PortalSpec<Name>
  readonly apiPrefix: `/api/${Id}`
  readonly accessPermission: PermissionKey<Id, Name>
  /** Decides who can use the app (see `OWNER_PERMISSION_NAME`). */
  readonly ownerPermission: PermissionKey<Id, typeof OWNER_PERMISSION_NAME>
  /** The app's roles as declared (or the default `member` role), then its `owner` role. */
  readonly roles: ReadonlyArray<ManifestRole>
  readonly events: ReadonlyArray<Event>
  readonly settings: Settings
  readonly statuses: Statuses
  readonly database: boolean
  readonly storage: boolean
  readonly backend: boolean
  /** Fully qualified, type-checked permission key. */
  perm<N extends Name>(name: N): PermissionKey<Id, N>
  /** Fully qualified, type-checked notification type key. */
  notification<N extends Notification>(name: N): NotificationKey<Id, N>
  /** Fully qualified, type-checked status key. */
  status<N extends keyof Statuses & string>(name: N): StatusKey<Id, N>
}

export type AnyApp = App<string, string, string, PlatformEventType, SettingsSpec, StatusesSpec>

/** Reserved ids that would clash with platform routes. */
const RESERVED_IDS = new Set([
  "api",
  "auth",
  "internal",
  "login",
  "assets",
  "notifications",
  "platform",
  "apps",
  // The shell's "All apps" page.
  "directory",
])

/** Whether an id is taken by a platform route or service (apps cannot use it). */
export const isReservedId = (id: string): boolean => RESERVED_IDS.has(id)

export const defineApp = <
  const Id extends string,
  const Name extends string,
  const Notification extends string = never,
  const Event extends PlatformEventType = never,
  const Settings extends SettingsSpec = NoSettings,
  const Statuses extends StatusesSpec = NoStatuses,
>(
  spec: AppSpec<Id, Name, Notification, Event, Settings, Statuses>,
): App<Id, Name, Notification, Event, Settings, Statuses> => {
  if (!AppIdPattern.test(spec.id) || RESERVED_IDS.has(spec.id)) {
    throw new Error(`Invalid app id "${spec.id}"`)
  }
  for (const name of Object.keys(spec.permissions)) {
    if (!PermissionNamePattern.test(name)) {
      throw new Error(`Invalid permission name "${name}" in app "${spec.id}"`)
    }
  }
  for (const [name, notification] of Object.entries<NotificationSpec>(spec.notifications ?? {})) {
    if (!PermissionNamePattern.test(name)) {
      throw new Error(`Invalid notification name "${name}" in app "${spec.id}"`)
    }
    if (notification.resolvedBy !== undefined && notification.action !== true) {
      throw new Error(`Notification "${name}" in app "${spec.id}" says who resolves it, but is not an action`)
    }
  }
  for (const [name, setting] of Object.entries<SettingsSpec[string]>(spec.settings ?? {})) {
    if (!SettingNamePattern.test(name))
      throw new Error(`Invalid setting name "${name}" in app "${spec.id}" (camelCase)`)
    const problem = settingProblem(setting, setting.default)
    if (problem !== undefined) throw new Error(`Default of setting "${name}" in app "${spec.id}": ${problem}`)
  }
  if (!(spec.access in spec.permissions)) {
    throw new Error(`Access permission "${spec.access}" is not defined in app "${spec.id}"`)
  }
  if (OWNER_PERMISSION_NAME in spec.permissions) {
    throw new Error(`Permission "${OWNER_PERMISSION_NAME}" is reserved (app "${spec.id}")`)
  }
  checkPages(spec.id, Object.keys(spec.permissions), spec.portal?.pages ?? [])
  for (const [name, status] of Object.entries<StatusSpec>(spec.statuses ?? {})) {
    if (!PermissionNamePattern.test(name)) throw new Error(`Invalid status name "${name}" in app "${spec.id}"`)
    if (status.page !== undefined && !PagePathPattern.test(status.page)) {
      throw new Error(`Invalid page "${status.page}" of status "${name}" in app "${spec.id}" (e.g. "/orders")`)
    }
  }
  const perm = <N extends Name>(name: N): PermissionKey<Id, N> => `${spec.id}:${name}`
  return {
    ...spec,
    [AppTypeId]: AppTypeId,
    events: [...new Set(spec.events ?? [])],
    settings: spec.settings ?? ({} as Settings),
    statuses: spec.statuses ?? ({} as Statuses),
    database: spec.database ?? false,
    storage: spec.storage ?? false,
    backend: spec.backend ?? true,
    portal: spec.portal ?? {},
    apiPrefix: `/api/${spec.id}`,
    accessPermission: perm(spec.access),
    ownerPermission: ownerPermission(spec.id),
    roles: appRoles(spec),
    perm,
    notification: (name) => `${spec.id}:${name}`,
    status: (name) => `${spec.id}:${name}`,
  }
}

/** The roles of an app: the declared ones (or `member`), then `owner`. */
const appRoles = (spec: AppSpec<string, string, string, PlatformEventType>): ReadonlyArray<ManifestRole> => {
  const access: PermissionKey = `${spec.id}:${spec.access}`
  const role = (name: string, title: string, description: string | null, grants: ReadonlyArray<PermissionKey>) =>
    new ManifestRole({
      id: appRoleId(spec.id, name),
      name: title,
      description,
      grants: [...new Set([access, ...grants])].sort(),
    })
  const declared = Object.entries(spec.roles ?? {})
  for (const [name] of declared) {
    if (!RoleNamePattern.test(name) || name === OWNER_ROLE_NAME) {
      throw new Error(`Invalid role name "${name}" in app "${spec.id}"`)
    }
  }
  const permissions = Object.keys(spec.permissions)
  return [
    ...(declared.length === 0
      ? [role(MEMBER_ROLE_NAME, "Member", `Can open ${spec.name}`, [])]
      : declared.map(([name, declaration]) =>
          role(
            name,
            declaration.name,
            declaration.description ?? null,
            expandRoleGrants(spec.id, permissions, declaration.grants ?? []),
          ),
        )),
    role(OWNER_ROLE_NAME, "Owner", `Decides who can use ${spec.name}`, [ownerPermission(spec.id)]),
  ]
}

/** The app with how the Portal lists it, for an app defined without (e.g. the Portal's own). */
export const withPortal = <A extends AnyApp>(app: A, portal: A["portal"]): A => {
  checkPages(app.id, Object.keys(app.permissions), portal.pages ?? [])
  return { ...app, portal }
}

/** A page's path: `/`, or segments without a trailing slash (`/orders`, `/orders/archive`). */
const PagePathPattern = /^\/([a-z0-9-]+(\/[a-z0-9-]+)*)?$/

/**
 * What keeps navigation from listing an app's pages: odd or repeated paths, permissions the app
 * does not define (its names, e.g. `orders.edit`). Empty when they are fine.
 */
export const pageProblems = (
  id: string,
  permissions: ReadonlyArray<string>,
  pages: ReadonlyArray<PortalPage>,
): ReadonlyArray<string> =>
  pages.flatMap((page, index) => [
    ...(PagePathPattern.test(page.path)
      ? []
      : [`Invalid page path "${page.path}" in app "${id}" (e.g. "/" or "/orders")`]),
    ...(pages.findIndex((other) => other.path === page.path) < index
      ? [`Page "${page.path}" is listed twice in app "${id}"`]
      : []),
    ...(page.permission === undefined || permissions.includes(page.permission)
      ? []
      : [`Page "${page.path}" in app "${id}" needs "${page.permission}", which the app does not define`]),
  ])

const checkPages = (id: string, permissions: ReadonlyArray<string>, pages: ReadonlyArray<PortalPage>): void => {
  const [problem] = pageProblems(id, permissions, pages)
  if (problem !== undefined) throw new Error(problem)
}

export const isApp = (u: unknown): u is AnyApp => typeof u === "object" && u !== null && AppTypeId in u

/** What the auth service registers of an app: its identity, permissions and roles. */
export class ManifestPermission extends Schema.Class<ManifestPermission>("@mosaik/core/ManifestPermission")({
  key: PermissionKey,
  description: Schema.String,
  dangerous: Schema.Boolean,
  defaultRoles: Schema.Array(Schema.String),
}) {}

export class ManifestPayload extends Schema.Class<ManifestPayload>("@mosaik/core/ManifestPayload")({
  id: Schema.String.check(Schema.isPattern(AppIdPattern)),
  name: Schema.String,
  description: Schema.NullOr(Schema.String),
  access: PermissionKey,
  /** Includes the owner permission. */
  permissions: Schema.Array(ManifestPermission),
  /** Includes the owner role. */
  roles: Schema.Array(ManifestRole),
}) {}

/** The app's permissions as registered: the declared ones, then the owner permission. */
export const manifestPermissions = (app: AnyApp): ReadonlyArray<ManifestPermission> => [
  ...Object.entries<PermissionSpec>(app.permissions).map(
    ([name, spec]) =>
      new ManifestPermission({
        key: app.perm(name),
        description: spec.description,
        dangerous: spec.dangerous ?? false,
        defaultRoles: spec.defaultRoles ?? [],
      }),
  ),
  new ManifestPermission({
    key: app.ownerPermission,
    description: `Decide who can use ${app.name}`,
    dangerous: true,
    defaultRoles: [],
  }),
]

export const toManifestPayload = (app: AnyApp): ManifestPayload =>
  new ManifestPayload({
    id: app.id,
    name: app.name,
    description: app.description ?? null,
    access: app.accessPermission,
    permissions: manifestPermissions(app),
    roles: app.roles,
  })
