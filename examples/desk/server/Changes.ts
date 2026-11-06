import { Context, Effect, Layer, PubSub, Stream } from "effect"
import type { RequestId } from "../api"

/**
 * Tells open pages that requests changed, so they refetch. Within this instance: an app that runs
 * several would pass it through its database or a broker.
 */
export class Changes extends Context.Service<
  Changes,
  {
    publish(ids: ReadonlyArray<RequestId>): Effect.Effect<void>
    readonly stream: Stream.Stream<ReadonlyArray<RequestId>>
  }
>()("@mosaik/desk/Changes") {
  static readonly layer = Layer.effect(
    Changes,
    Effect.map(PubSub.unbounded<ReadonlyArray<RequestId>>(), (hub) =>
      Changes.of({
        publish: (ids) => PubSub.publish(hub, ids).pipe(Effect.asVoid),
        stream: Stream.fromPubSub(hub),
      }),
    ),
  )
}
