import { Effect, Layer, Schedule } from "effect"
import { SqlClient } from "effect/sql"

/**
 * Demo only, with `0002_demo_data`: moves the demo's requests along with the clock, so that it opens
 * with some overdue, some due soon and some with time left, however long ago it was set up. Delete
 * both for a real app: nothing else knows about them.
 */
export const DemoFreshness = Layer.effectDiscard(
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    yield* sql`SELECT refresh_demo()`.pipe(
      Effect.catchCause((cause) => Effect.logWarning("Could not refresh the demo's requests", cause)),
      Effect.repeat(Schedule.spaced("1 hour")),
      Effect.forkScoped,
    )
  }),
)
