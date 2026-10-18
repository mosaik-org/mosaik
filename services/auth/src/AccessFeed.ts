import { PgClient } from "@effect/sql-pg"
import { AccessChange } from "@mosaik/auth/contract"
import { UserId } from "@mosaik/core"
import { Context, Effect, Layer, PubSub, Queue, Schedule, Stream } from "effect"

/** Notified by the access signal triggers (`0001_initial` migration): a user id, or `*`. */
const CHANNEL = "mosaik_access"

const EVERYONE = new AccessChange({ user: null })

/** Access changes as they commit (Postgres LISTEN/NOTIFY), for the gateway and browsers. */
export class AccessFeed extends Context.Service<
  AccessFeed,
  {
    /** Starts with a change for everyone (whatever happened before is unknown), then each change. */
    readonly changes: Stream.Stream<AccessChange>
  }
>()("@mosaik/auth-service/AccessFeed") {
  static readonly layer = Layer.effect(
    AccessFeed,
    Effect.gen(function* () {
      const sql = yield* PgClient.PgClient
      const changes = yield* PubSub.unbounded<AccessChange>()

      yield* Effect.gen(function* () {
        const notifications = yield* sql.listen(CHANNEL)
        // Signals sent while the listener was down are lost: tell everyone to start over.
        yield* PubSub.publish(changes, EVERYONE)
        while (true) {
          const { payload } = yield* Queue.take(notifications)
          yield* PubSub.publish(changes, payload === "*" ? EVERYONE : new AccessChange({ user: UserId.make(payload) }))
        }
      }).pipe(
        Effect.scoped,
        Effect.tapCause((cause) => Effect.logWarning("Access listener stopped, reconnecting", cause)),
        Effect.retry(Schedule.spaced("5 seconds")),
        Effect.forkScoped,
      )

      return AccessFeed.of({
        changes: Stream.unwrap(
          Effect.map(PubSub.subscribe(changes), (subscription) =>
            Stream.concat(Stream.make(EVERYONE), Stream.fromSubscription(subscription)),
          ),
        ),
      })
    }),
  )
}
