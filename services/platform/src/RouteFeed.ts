import { PgClient } from "@effect/sql-pg"
import type { AppRoute } from "@mosaik/platform/contract"
import { Context, Effect, Layer, PubSub, Queue, Schedule, Stream } from "effect"
import { Apps } from "./Apps"

/** Postgres channel, notified by a trigger on every change to `apps` that can affect routing. */
const CHANNEL = "mosaik_routes"

/** The app routes as they change, for the gateway (Postgres LISTEN/NOTIFY). */
export class RouteFeed extends Context.Service<
  RouteFeed,
  {
    /** The current routes, then the routes again after every change. */
    readonly changes: Stream.Stream<ReadonlyArray<AppRoute>>
  }
>()("@mosaik/platform-service/RouteFeed") {
  static readonly layer = Layer.effect(
    RouteFeed,
    Effect.gen(function* () {
      const sql = yield* PgClient.PgClient
      const apps = yield* Apps
      const signals = yield* PubSub.sliding<void>(1)

      yield* Effect.gen(function* () {
        const notifications = yield* sql.listen(CHANNEL)
        while (true) {
          yield* Queue.take(notifications)
          yield* PubSub.publish(signals, undefined)
        }
      }).pipe(
        Effect.scoped,
        Effect.tapCause((cause) => Effect.logWarning("Route listener stopped, reconnecting", cause)),
        Effect.retry(Schedule.spaced("5 seconds")),
        Effect.forkScoped,
      )

      return RouteFeed.of({
        changes: Stream.unwrap(
          Effect.gen(function* () {
            // Subscribe before reading, so no change between the two is missed.
            const subscription = yield* PubSub.subscribe(signals)
            const initial = yield* apps.routes
            // Several changes in a row (an install updates the app a few times) are read once.
            const changes = Stream.fromSubscription(subscription).pipe(
              Stream.debounce("100 millis"),
              Stream.mapEffect(() => apps.routes),
            )
            return Stream.concat(Stream.make(initial), changes).pipe(Stream.changesWith(sameRoutes))
          }),
        ),
      })
    }),
  )
}

const sameRoutes = (a: ReadonlyArray<AppRoute>, b: ReadonlyArray<AppRoute>) =>
  a.length === b.length && a.every((route, index) => route.id === b[index]?.id && route.upstream === b[index]?.upstream)
