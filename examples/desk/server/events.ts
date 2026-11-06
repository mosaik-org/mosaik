import { isGranted } from "@mosaik/sdk"
import { Events } from "@mosaik/sdk/server"
import { DateTime, Effect } from "effect"
import { applyChange, Person } from "../api"
import { desk } from "../manifest"
import { Changes } from "./Changes"
import { People } from "./People"
import { Requests } from "./Requests"
import { Setup } from "./Setup"
import { Statuses } from "./Statuses"

/**
 * What Mosaik tells the desk about people. Safe to repeat, as delivery is at least once: each only
 * says how things should be now.
 */
export const EventHandlers = Events.handlers(
  desk,
  Effect.gen(function* () {
    const people = yield* People
    const requests = yield* Requests
    const setup = yield* Setup
    const changes = yield* Changes
    const statuses = yield* Statuses

    /** Nobody can do anything about what is assigned to someone who cannot reach it: back to the queue. */
    const unassign = Effect.fn("unassign")(function* (userId: string) {
      const now = yield* DateTime.now
      const assigned = yield* requests.assignedTo(userId)
      for (const request of assigned) {
        yield* requests
          .edit(request.id, (current) =>
            Effect.gen(function* () {
              const rule = yield* setup.deadline(current.priority)
              const next = applyChange(
                current,
                { assigneeId: null, ...(current.status === "open" ? { status: "new" as const } : {}) },
                rule,
                null,
                now,
              )
              return {
                request: next,
                activity: [
                  { kind: "change", authorId: null, field: "assignee", from: null, to: null, createdAt: now } as const,
                ],
              }
            }),
          )
          .pipe(Effect.catchTag("NotFound", () => Effect.void))
      }
      if (assigned.length > 0) {
        yield* changes.publish(assigned.map((request) => request.id))
        yield* statuses.recount
      }
    })

    return {
      "user.created": ({ user }) => people.save(new Person(user), false),
      "user.deleted": ({ userId }) => Effect.andThen(people.markLeft(userId), unassign(userId)),
      "user.access_changed": ({ userId, hasAccess, grants }) => {
        const agent = hasAgentGrant(hasAccess, grants)
        return Effect.andThen(people.setAgent(userId, agent), agent ? Effect.void : unassign(userId))
      },
    }
  }),
)

const hasAgentGrant = (hasAccess: boolean, grants: ReadonlyArray<string>) =>
  hasAccess && isGranted(grants, desk.perm("requests.work"))
