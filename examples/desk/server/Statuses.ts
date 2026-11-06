import { StatusAudiences, UserId } from "@mosaik/sdk"
import { Status } from "@mosaik/sdk/server"
import { Context, DateTime, Effect, Layer } from "effect"
import { desk } from "../manifest"
import { Requests } from "./Requests"

/** Keeps what the desk shows beside its pages in Mosaik's navigation in step with its requests. */
export class Statuses extends Context.Service<
  Statuses,
  {
    /** Counts everything again. Showing it never fails what changed it. */
    readonly recount: Effect.Effect<void>
  }
>()("@mosaik/desk/Statuses") {
  static readonly layer = Layer.effect(
    Statuses,
    Effect.gen(function* () {
      const requests = yield* Requests
      const status = yield* Status.for(desk)
      return Statuses.of({
        recount: Effect.gen(function* () {
          const now = yield* DateTime.now
          const [inbox, waiting, overdue] = yield* Effect.all([
            requests.yourMoveByAssignee,
            requests.waitingByRequester,
            requests.overdueCount(now),
          ])
          yield* status.replace(
            "inbox",
            inbox.map(
              ({ personId, count }) => [StatusAudiences.user(UserId.make(personId)), count, { link: "/" }] as const,
            ),
          )
          yield* status.replace(
            "mine",
            waiting.map(
              ({ personId, count }) => [StatusAudiences.user(UserId.make(personId)), count, { link: "/mine" }] as const,
            ),
          )
          yield* status.set("overdue", StatusAudiences.permission(desk.perm("requests.work")), overdue, {
            link: "/all",
          })
        }).pipe(Effect.catchTag("StatusError", (error) => Effect.logWarning("Could not show what waits", error))),
      })
    }),
  )
}
