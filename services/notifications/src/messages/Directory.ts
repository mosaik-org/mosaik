import { InternalClient } from "@mosaik/auth/server"
import { BadRequest, type PrincipalUser, type UserId } from "@mosaik/core"
import type { Audience } from "@mosaik/notifications/contract"
import { Context, Effect, Layer, Schedule } from "effect"

/** Mosaik users and their contact details, from the auth service. */
export class Directory extends Context.Service<
  Directory,
  {
    /** These users; fails for unknown ids. */
    users(ids: ReadonlyArray<UserId>): Effect.Effect<ReadonlyArray<PrincipalUser>, BadRequest>
    /** Everyone in the audience. */
    audience(audience: Audience): Effect.Effect<ReadonlyArray<PrincipalUser>, BadRequest>
  }
>()("@mosaik/notifications-service/Directory") {
  static readonly layer = Layer.effect(
    Directory,
    Effect.gen(function* () {
      const auth = yield* InternalClient
      const resilient = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
        effect.pipe(Effect.retry({ schedule: Schedule.exponential("200 millis"), times: 3 }), Effect.orDie)

      const users = Effect.fn("Directory.users")(function* (ids: ReadonlyArray<UserId>) {
        const unique = [...new Set(ids)]
        if (unique.length === 0) return []
        const found = yield* resilient(auth.internal.lookupUsers({ payload: { ids: unique } }))
        const unknown = unique.filter((id) => !found.some((user) => user.id === id))
        if (unknown.length > 0) return yield* new BadRequest({ message: `Unknown users: ${unknown.join(", ")}` })
        return found
      })

      return Directory.of({
        users,
        audience: (audience) =>
          audience._tag === "Users"
            ? users(audience.userIds)
            : resilient(
                auth.internal.usersWithPermission({
                  payload: { permission: audience._tag === "Permission" ? audience.permission : null },
                }),
              ),
      })
    }),
  )
}
