import { PgClient } from "@effect/sql-pg"
import { type RegisteredApp, RoleRef } from "@mosaik/auth/contract"
import { InternalClient } from "@mosaik/auth/server"
import {
  BadRequest,
  Conflict,
  Forbidden,
  isGranted,
  NotFound,
  namespacesGranting,
  OWNER_PERMISSION_NAME,
  ownerPermission,
  type Principal,
  type PrincipalUser,
  type UserId,
} from "@mosaik/core"
import {
  type Audience,
  Audiences,
  type Content,
  NotificationRequest,
  NotificationTypeInput,
  NotificationTypesPayload,
} from "@mosaik/notifications/contract"
import { AccessAdmin, AccessRequest, type AccessRequestStatus, canManageApp } from "@mosaik/platform/contract"
import { Context, Effect, Layer, Option, Schedule, Schema } from "effect"
import { SqlSchema } from "effect/sql"
import { Apps } from "./Apps"
import { NotificationsClient } from "./clients"

/** The platform sends notifications as `platform`, an id no app can take. */
const SOURCE = "platform"

export const AccessNotifications = {
  requested: `${SOURCE}:access.requested`,
  answered: `${SOURCE}:access.answered`,
} as const

const NOTIFICATION_TYPES = [
  new NotificationTypeInput({
    key: AccessNotifications.requested,
    description: "Someone asked for access to an app",
    defaultChannels: ["inApp", "email"],
  }),
  new NotificationTypeInput({
    key: AccessNotifications.answered,
    description: "Your request for access to an app was answered",
    defaultChannels: ["inApp", "email"],
  }),
]

/** Where owners and admins answer an app's requests: the console's app page, with or without the Portal. */
const reviewPath = (app: string) => `/manage/${app}?tab=requests`

const RequestRow = Schema.Struct({
  ...AccessRequest.fields,
  createdAt: Schema.DateTimeUtcFromDate,
  decidedAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
})

export interface RequestFilter {
  readonly status?: AccessRequestStatus | undefined
  readonly app?: string | undefined
}

/**
 * Requests for access to apps. The app's owners (or, for apps without any, the admins)
 * approve one by giving the user one of the app's roles, or decline it; a request also
 * closes by itself once the user gets access some other way.
 */
export class AccessRequests extends Context.Service<
  AccessRequests,
  {
    /** The user's pending requests, and the ones answered recently. */
    mine(user: UserId): Effect.Effect<ReadonlyArray<AccessRequest>>
    request(
      principal: Principal,
      app: string,
      role: string | null,
      message: string | null,
    ): Effect.Effect<AccessRequest, NotFound | BadRequest>
    /** The requests the principal may answer ({@link canManageApp}), newest first. */
    list(principal: Principal, filter: RequestFilter): Effect.Effect<ReadonlyArray<AccessRequest>>
    approve(
      principal: Principal,
      id: number,
      role: string,
    ): Effect.Effect<AccessRequest, NotFound | BadRequest | Conflict | Forbidden>
    decline(
      principal: Principal,
      id: number,
      reason: string | null,
    ): Effect.Effect<AccessRequest, NotFound | Conflict | Forbidden>
    /** Closes the user's pending requests that their grants now cover. */
    accessChanged(user: UserId, grants: ReadonlyArray<string>): Effect.Effect<void>
    forgetUser(user: UserId): Effect.Effect<void>
    forgetApp(app: string): Effect.Effect<void>
  }
>()("@mosaik/platform-service/AccessRequests") {
  static readonly layer = Layer.effect(
    AccessRequests,
    Effect.gen(function* () {
      const sql = yield* PgClient.PgClient
      const auth = yield* InternalClient
      const apps = yield* Apps
      const notifications = yield* NotificationsClient

      // The notifications service may still be starting.
      yield* notifications.notifications
        .registerTypes({ payload: new NotificationTypesPayload({ source: SOURCE, types: NOTIFICATION_TYPES }) })
        .pipe(
          Effect.retry(Schedule.spaced("5 seconds")),
          Effect.catchCause((cause) => Effect.logError("Could not register notification types", cause)),
          Effect.forkScoped,
        )

      const columns = sql.literal(`
        id, app_id AS app, app_name, access, user_id, user_name, user_email, role, message, status,
        created_at, decided_at, decided_by, granted_role, response
      `)
      const decode = (row: typeof RequestRow.Type) => new AccessRequest(row)
      const findById = SqlSchema.findOneOption({
        Request: Schema.Number,
        Result: RequestRow,
        execute: (id) => sql`SELECT ${columns} FROM access_requests WHERE id = ${id}`,
      })
      const findPending = SqlSchema.findOneOption({
        Request: Schema.Struct({ user: Schema.String, app: Schema.String }),
        Result: RequestRow,
        execute: ({ user, app }) => sql`
          SELECT ${columns} FROM access_requests WHERE user_id = ${user} AND app_id = ${app} AND status = 'pending'
        `,
      })
      const findMine = SqlSchema.findAll({
        Request: Schema.String,
        Result: RequestRow,
        execute: (user) => sql`
          SELECT ${columns} FROM access_requests
          WHERE user_id = ${user} AND (status = 'pending' OR decided_at > now() - interval '30 days')
          ORDER BY created_at DESC
        `,
      })
      const findAll = SqlSchema.findAll({
        Request: Schema.Struct({
          status: Schema.NullOr(Schema.String),
          apps: Schema.NullOr(Schema.Array(Schema.String)),
        }),
        Result: RequestRow,
        execute: ({ status, apps }) => sql`
          SELECT ${columns} FROM access_requests
          WHERE ${status === null ? sql.literal("true") : sql`status = ${status}`}
            AND ${apps === null ? sql.literal("true") : sql`app_id IN ${sql.in(apps)}`}
          ORDER BY created_at DESC
          LIMIT 200
        `,
      })
      const findPendingOf = SqlSchema.findAll({
        Request: Schema.String,
        Result: RequestRow,
        execute: (user) => sql`SELECT ${columns} FROM access_requests WHERE user_id = ${user} AND status = 'pending'`,
      })

      /** Delivery is best effort: the request itself is what matters. */
      const notify = (
        type: string,
        audience: Audience,
        content: Content,
        idempotencyKey: string,
        exclude: ReadonlyArray<UserId> = [],
      ) =>
        notifications.notifications
          .send({
            payload: new NotificationRequest({ source: SOURCE, type, audience, content, exclude, idempotencyKey }),
          })
          .pipe(Effect.catchCause((cause) => Effect.logWarning("Could not send an access notification", cause)))

      /** Where the app opens: a standalone app's own address, else its path in the Portal. */
      const openLink = (app: string) =>
        apps.get(app).pipe(
          Effect.map((record) =>
            Option.getOrElse(
              Option.flatMapNullishOr(record, (row) => row.publicUrl),
              () => `/${app}`,
            ),
          ),
        )

      const tellRequester = (request: AccessRequest) =>
        Effect.flatMap(openLink(request.app), (link) =>
          notify(
            AccessNotifications.answered,
            Audiences.users(request.userId),
            request.status === "approved"
              ? {
                  title: `You can now open ${request.appName}`,
                  ...(request.grantedRole === null ? {} : { body: `You have the ${request.grantedRole.name} role.` }),
                  link,
                  linkLabel: `Open ${request.appName}`,
                  severity: "success",
                }
              : {
                  title: `Your request for access to ${request.appName} was declined`,
                  ...(request.response === null ? {} : { body: request.response }),
                },
            `access-request-${request.id}-${request.status}`,
          ),
        )

      const get = Effect.fn("AccessRequests.get")(function* (id: number) {
        const row = yield* findById(id).pipe(Effect.orDie)
        if (Option.isNone(row)) return yield* new NotFound({ resource: "access request", id: String(id) })
        return decode(row.value)
      })

      /** Answers a pending request; `Conflict` if someone answered it first. */
      const decide = Effect.fn("AccessRequests.decide")(function* (
        id: number,
        answer: {
          readonly status: "approved" | "declined"
          readonly decidedBy: PrincipalUser | null
          readonly grantedRole?: RoleRef
          readonly response?: string | null
        },
      ) {
        const rows = yield* sql`
          UPDATE access_requests
          SET status = ${answer.status}, decided_at = now(), decided_by = ${answer.decidedBy?.name ?? null},
            granted_role = ${answer.grantedRole === undefined ? null : sql.json({ ...answer.grantedRole })},
            response = ${answer.response ?? null}
          WHERE id = ${id} AND status = 'pending'
          RETURNING id
        `.pipe(Effect.orDie)
        if (rows.length === 0) return yield* new Conflict({ message: "The request was already answered" })
        const request = yield* get(id).pipe(Effect.orDie)
        yield* tellRequester(request)
        return request
      })

      /** A pending request the principal may answer. */
      const reviewable = Effect.fn(function* (principal: Principal, id: number) {
        const request = yield* get(id)
        if (!canManageApp(principal, request.app))
          return yield* new Forbidden({ permission: ownerPermission(request.app) })
        if (request.status !== "pending") {
          return yield* new Conflict({ message: `The request was already ${request.status}` })
        }
        return request
      })

      const registeredApp = (app: string): Effect.Effect<RegisteredApp, NotFound> =>
        auth.internal.app({ params: { id: app } }).pipe(
          Effect.catchTag("NotFound", () => Effect.fail(new NotFound({ resource: "app", id: app }))),
          Effect.catchIf((error) => error._tag !== "NotFound", Effect.die),
        )

      /** One of the app's current roles. */
      const appRole = Effect.fn(function* (registered: RegisteredApp, role: string) {
        const found = registered.roles.find((candidate) => candidate.id === role && !candidate.stale)
        if (found === undefined) return yield* new BadRequest({ message: `${registered.name} has no role ${role}` })
        return new RoleRef({ id: found.id, name: found.name })
      })

      /**
       * Who answers the app's requests: its owners, through roles that name the app (not
       * superadmins, who own everything); the admins when it has none.
       */
      const reviewers = (app: string, requester: UserId) =>
        auth.internal.usersWithPermission({ payload: { permission: ownerPermission(app), explicit: true } }).pipe(
          Effect.map((owners) => owners.map((owner) => owner.id).filter((id) => id !== requester)),
          Effect.map((owners) =>
            owners.length === 0 ? Audiences.permission(AccessAdmin.manage) : Audiences.users(...owners),
          ),
          Effect.orDie,
        )

      return AccessRequests.of({
        mine: (user) =>
          findMine(user).pipe(
            Effect.map((rows) => rows.map(decode)),
            Effect.orDie,
          ),

        request: Effect.fn("AccessRequests.request")(function* (
          principal: Principal,
          app: string,
          role: string | null,
          message: string | null,
        ) {
          const user = principal.user
          if (user === null) return yield* new BadRequest({ message: "Log in to ask for access" })
          const registered = yield* registeredApp(app)
          if (principal.can(registered.access)) {
            return yield* new BadRequest({ message: `You can already open ${registered.name}` })
          }
          const wanted = role === null ? null : yield* appRole(registered, role)
          const existing = yield* findPending({ user: user.id, app }).pipe(Effect.orDie)
          if (Option.isSome(existing)) return decode(existing.value)

          const note = message?.trim() || null
          const [row] = yield* sql<{ id: number }>`
            INSERT INTO access_requests ${sql.insert({
              appId: registered.id,
              appName: registered.name,
              access: registered.access,
              userId: user.id,
              userName: user.name,
              userEmail: user.email,
              role: wanted === null ? null : sql.json({ ...wanted }),
              message: note,
            })}
            ON CONFLICT (user_id, app_id) WHERE status = 'pending' DO NOTHING
            RETURNING id
          `.pipe(Effect.orDie)
          // Asked twice at once: the other request won.
          if (row === undefined) {
            const winner = yield* findPending({ user: user.id, app }).pipe(Effect.orDie)
            if (Option.isSome(winner)) return decode(winner.value)
            return yield* Effect.die("An access request vanished")
          }
          const request = yield* get(row.id).pipe(Effect.orDie)
          yield* notify(
            AccessNotifications.requested,
            yield* reviewers(app, user.id),
            {
              title: `${user.name} asked for access to ${registered.name}`,
              ...(note === null ? {} : { body: note }),
              link: reviewPath(app),
              linkLabel: "Review request",
              fields: [
                { label: "E-mail", value: user.email },
                ...(wanted === null ? [] : [{ label: "Role", value: wanted.name }]),
              ],
            },
            `access-request-${request.id}`,
            [user.id],
          )
          return request
        }),

        list: Effect.fn("AccessRequests.list")(function* (principal: Principal, filter: RequestFilter) {
          const managed = principal.can(AccessAdmin.manage)
            ? "all"
            : namespacesGranting(principal.grants, OWNER_PERMISSION_NAME)
          // `null`: every app.
          const apps =
            managed === "all"
              ? filter.app === undefined
                ? null
                : [filter.app]
              : [...managed].filter((app) => filter.app === undefined || app === filter.app)
          if (apps !== null && apps.length === 0) return []
          const rows = yield* findAll({ status: filter.status ?? null, apps }).pipe(Effect.orDie)
          return rows.map(decode)
        }),

        approve: Effect.fn("AccessRequests.approve")(function* (principal: Principal, id: number, role: string) {
          const request = yield* reviewable(principal, id)
          const granted = yield* appRole(yield* registeredApp(request.app), role)
          yield* auth.internal.addRole({ params: { id: request.userId }, payload: { role: granted.id } }).pipe(
            Effect.catchTag("NotFound", () => Effect.fail(new NotFound({ resource: "user", id: request.userId }))),
            Effect.catchIf((error) => error._tag !== "NotFound" && error._tag !== "BadRequest", Effect.die),
          )
          return yield* decide(id, { status: "approved", decidedBy: principal.user, grantedRole: granted })
        }),

        decline: Effect.fn("AccessRequests.decline")(function* (
          principal: Principal,
          id: number,
          reason: string | null,
        ) {
          yield* reviewable(principal, id)
          return yield* decide(id, { status: "declined", decidedBy: principal.user, response: reason?.trim() || null })
        }),

        accessChanged: Effect.fn("AccessRequests.accessChanged")(function* (
          user: UserId,
          grants: ReadonlyArray<string>,
        ) {
          const open = yield* findPendingOf(user).pipe(Effect.orDie)
          for (const row of open) {
            if (!isGranted(grants, row.access)) continue
            // An admin answering at the same moment is fine: either way the request is closed.
            yield* decide(row.id, { status: "approved", decidedBy: null }).pipe(
              Effect.catchTag("Conflict", () => Effect.void),
            )
          }
        }),

        forgetUser: (user) =>
          sql`DELETE FROM access_requests WHERE user_id = ${user}`.pipe(Effect.asVoid, Effect.orDie),
        forgetApp: (app) => sql`DELETE FROM access_requests WHERE app_id = ${app}`.pipe(Effect.asVoid, Effect.orDie),
      })
    }),
  )
}
