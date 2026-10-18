import { PlatformEventData } from "@mosaik/core"
import { MAX_EVENTS_WAIT_SECONDS } from "@mosaik/platform/contract"
import { Duration, Effect, Layer, Schedule, Schema } from "effect"
import { CoreClient } from "./clients"
import { Workspace } from "./Workspace"

const SERVICE = "portal"
const decodeDeleted = Schema.decodeUnknownEffect(PlatformEventData["user.deleted"])

/**
 * Follows Core's platform events like an app does, as the service `portal`: when a user is
 * deleted, their pins and usage go too. A failure is reported to Core and retried.
 */
export const UserEvents = Layer.effectDiscard(
  Effect.gen(function* () {
    const core = yield* CoreClient
    const workspace = yield* Workspace
    const params = { service: SERVICE }

    const ack = (position: number, error: string | null) =>
      core.events.acknowledge({ params, payload: { position, error } })

    /** One batch: returns whether every event was handled. */
    const round = Effect.gen(function* () {
      const batch = yield* core.events.receive({
        params,
        payload: { types: ["user.deleted"], wait: MAX_EVENTS_WAIT_SECONDS },
      })
      let handled: number | null = null
      for (const event of batch.events) {
        const exit = yield* Effect.exit(
          decodeDeleted(event.data).pipe(Effect.flatMap(({ userId }) => workspace.forgetUser(userId))),
        )
        if (exit._tag === "Failure") {
          yield* Effect.logError("Handling a platform event failed, will retry", exit.cause)
          yield* ack(handled ?? 0, `${event.type} (${event.id}) failed`)
          return false
        }
        handled = event.position
      }
      if (handled !== null) yield* ack(handled, null)
      return true
    })

    const backoff = Schedule.min([Schedule.exponential("1 second"), Schedule.spaced(Duration.minutes(1))])
    yield* round.pipe(
      Effect.flatMap((ok) => (ok ? Effect.void : Effect.fail("handler" as const))),
      Effect.tapError((error) =>
        error === "handler" ? Effect.void : Effect.logWarning(`Could not fetch events (${error._tag}), retrying`),
      ),
      Effect.retry(backoff),
      Effect.forever,
      Effect.forkScoped,
    )
  }),
)
