import { Duration, Effect, Layer, Schedule } from "effect"
import { NotificationsConfig } from "../NotificationsConfig"
import { Fanout } from "./Fanout"
import { Inbox } from "./Inbox"

/** How soon a snoozed item comes back after its time. */
const WAKE_EVERY = Duration.seconds(30)
const PRUNE_EVERY = Duration.hours(1)

/**
 * Keeps inboxes current in the background: brings snoozed items back when their time comes (announced,
 * so the person sees them as if new), and removes what was resolved, and information read and left,
 * after `INBOX_RETENTION_DAYS`. Each instance runs it; both are safe to run at once.
 */
export const layer = Layer.effectDiscard(
  Effect.gen(function* () {
    const inbox = yield* Inbox
    const fanout = yield* Fanout
    const config = yield* NotificationsConfig

    const wake = Effect.gen(function* () {
      const woken = yield* inbox.wake
      if (woken.length > 0) yield* fanout.announceItems(woken)
    })
    const prune = Effect.gen(function* () {
      const removed = yield* inbox.prune(new Date(Date.now() - Duration.toMillis(config.inboxRetention)))
      if (removed > 0) yield* Effect.logInfo("Removed old inbox items", { removed })
    })

    yield* wake.pipe(
      Effect.catchCause((cause) => Effect.logWarning("Could not bring back snoozed notifications", cause)),
      Effect.repeat(Schedule.spaced(WAKE_EVERY)),
      Effect.forkScoped,
    )
    yield* prune.pipe(
      Effect.catchCause((cause) => Effect.logWarning("Could not remove old inbox items", cause)),
      Effect.repeat(Schedule.spaced(PRUNE_EVERY)),
      Effect.forkScoped,
    )
  }),
)
