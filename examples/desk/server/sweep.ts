import { UserId } from "@mosaik/sdk"
import { Audiences, Notify, Settings } from "@mosaik/sdk/server"
import { Context, DateTime, Effect, Layer, Schedule } from "effect"
import { applyChange, deadlineOf, nextDue, requestNumber } from "../api"
import { desk } from "../manifest"
import { Changes } from "./Changes"
import { Requests } from "./Requests"
import { Setup } from "./Setup"
import { Statuses } from "./Statuses"

/** What happens because time passed rather than because someone did something. */
export class Sweep extends Context.Service<
  Sweep,
  {
    readonly run: Effect.Effect<void>
  }
>()("@mosaik/desk/Sweep") {
  static readonly layer = Layer.effect(
    Sweep,
    Effect.gen(function* () {
      const requests = yield* Requests
      const setup = yield* Setup
      const changes = yield* Changes
      const statuses = yield* Statuses
      const notify = yield* Notify
      const settings = yield* Settings.for(desk)

      const tellOverdue = Effect.gen(function* () {
        const now = yield* DateTime.now
        for (const request of yield* requests.overdueToTell(now)) {
          const due = nextDue(request)
          if (due === undefined) continue
          yield* notify
            .send({
              type: desk.notification("request.overdue"),
              // Whoever has it. With nobody on it, everyone who could pick it up.
              audience:
                request.assigneeId === null
                  ? Audiences.permission(desk.perm("requests.work"))
                  : Audiences.users(UserId.make(request.assigneeId)),
              content: {
                title: `${requestNumber(request.id)} is overdue: ${request.title}`,
                body:
                  deadlineOf(request, now)?.kind === "reply"
                    ? "Nobody has answered in time."
                    : "It has not been solved in time.",
                severity: "warning",
                link: `/desk?open=${request.id}`,
                linkLabel: "Open request",
              },
              idempotencyKey: `overdue-${request.id}-${DateTime.toEpochMillis(due.at)}`,
            })
            .pipe(Effect.ignore)
          yield* requests.markOverdueTold(request.id, due.at)
        }
      })

      const closeOldSolved = Effect.gen(function* () {
        const now = yield* DateTime.now
        const days = yield* settings.get("closeAfterDays")
        const old = yield* requests.solvedBefore(DateTime.subtract(now, { days }))
        for (const request of old) {
          yield* requests
            .edit(request.id, (current) =>
              Effect.gen(function* () {
                const rule = yield* setup.deadline(current.priority)
                return {
                  request: applyChange(current, { status: "closed" }, rule, null, now),
                  activity: [
                    {
                      kind: "change",
                      authorId: null,
                      field: "status",
                      from: "Solved",
                      to: "Closed",
                      createdAt: now,
                    } as const,
                  ],
                }
              }),
            )
            // Reopened or deleted a moment ago: nothing to close.
            .pipe(Effect.catchTag("NotFound", () => Effect.void))
        }
        if (old.length > 0) {
          yield* changes.publish(old.map((request) => request.id))
        }
      })

      return Sweep.of({
        run: Effect.gen(function* () {
          yield* tellOverdue
          yield* closeOldSolved
          yield* statuses.recount
        }),
      })
    }),
  )

  /** Runs it when the app starts and every minute. A failed round is logged, and the next one tries again. */
  static readonly running = Layer.effectDiscard(
    Effect.flatMap(Sweep, (sweep) =>
      sweep.run.pipe(
        Effect.catchCause((cause) => Effect.logWarning("The desk's sweep failed", cause)),
        Effect.repeat(Schedule.spaced("1 minute")),
        Effect.forkScoped,
      ),
    ),
  )
}
