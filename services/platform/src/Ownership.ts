import type { AppMember } from "@mosaik/auth/contract"
import { InternalClient } from "@mosaik/auth/server"
import {
  type BadRequest,
  Forbidden,
  NotFound,
  ownerPermission,
  type Principal,
  type PrincipalUser,
  type UserId,
} from "@mosaik/core"
import { AppAbout, canManageApp } from "@mosaik/platform/contract"
import { Context, Effect, Layer } from "effect"

/**
 * Who decides who can use an app: its owners (and admins) give people the app's roles. The
 * auth service holds the roles; this service decides who may change them.
 */
export class Ownership extends Context.Service<
  Ownership,
  {
    about(app: string): Effect.Effect<AppAbout, NotFound>
    members(principal: Principal, app: string): Effect.Effect<ReadonlyArray<AppMember>, NotFound | Forbidden>
    /** Sets the user's roles in the app; returns who they are, for the audit log. */
    setMemberRoles(
      principal: Principal,
      app: string,
      user: UserId,
      roles: ReadonlyArray<string>,
    ): Effect.Effect<PrincipalUser, NotFound | BadRequest | Forbidden>
    people(principal: Principal, app: string, query: string): Effect.Effect<ReadonlyArray<PrincipalUser>, Forbidden>
  }
>()("@mosaik/platform-service/Ownership") {
  static readonly layer = Layer.effect(
    Ownership,
    Effect.gen(function* () {
      const auth = yield* InternalClient

      /** Fails unless the principal manages the app ({@link canManageApp}). */
      const check = (principal: Principal, app: string) =>
        canManageApp(principal, app) ? Effect.void : Effect.fail(new Forbidden({ permission: ownerPermission(app) }))

      const access = (app: string) =>
        auth.internal.appAccess({ params: { id: app } }).pipe(
          Effect.catchTag("NotFound", () => Effect.fail(new NotFound({ resource: "app", id: app }))),
          Effect.catchIf((error) => error._tag !== "NotFound", Effect.die),
        )

      return Ownership.of({
        about: Effect.fn("Ownership.about")(function* (app: string) {
          const { app: registered, openTo, members } = yield* access(app)
          return new AppAbout({
            app: registered,
            openTo,
            owners: members.filter((member) => member.owner).map((member) => member.user),
          })
        }),

        members: Effect.fn("Ownership.members")(function* (principal: Principal, app: string) {
          yield* check(principal, app)
          return (yield* access(app)).members
        }),

        setMemberRoles: Effect.fn("Ownership.setMemberRoles")(function* (
          principal: Principal,
          app: string,
          user: UserId,
          roles: ReadonlyArray<string>,
        ) {
          yield* check(principal, app)
          yield* auth.internal
            .setAppRoles({ params: { id: app, user }, payload: { roles } })
            .pipe(Effect.catchIf((error) => error._tag !== "NotFound" && error._tag !== "BadRequest", Effect.die))
          const [person] = yield* auth.internal.lookupUsers({ payload: { ids: [user] } }).pipe(Effect.orDie)
          if (person === undefined) return yield* new NotFound({ resource: "user", id: user })
          return person
        }),

        people: Effect.fn("Ownership.people")(function* (principal: Principal, app: string, query: string) {
          yield* check(principal, app)
          return yield* auth.internal.searchUsers({ payload: { query } }).pipe(Effect.orDie)
        }),
      })
    }),
  )
}
