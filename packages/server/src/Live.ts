import { Effect, Schema, Stream } from "effect"
import { HttpServerResponse } from "effect/http"

export interface EventStreamOptions {
  /** Comment sent periodically so proxies keep the connection open. Defaults to 15 seconds. */
  readonly heartbeat?: `${number} seconds`
}

/**
 * Serves a stream as Server-Sent Events, each value encoded as JSON with `schema`.
 * Return it from an `HttpApi` handler; consume it in the browser with
 * `createEventStream` from `@mosaik/sdk` and the same schema.
 */
export const eventStream = <S extends Schema.Codec<any, any>, E, R>(
  schema: S,
  stream: Stream.Stream<S["Type"], E, R>,
  options: EventStreamOptions = {},
) =>
  Effect.gen(function* () {
    const context = yield* Effect.context<R>()
    const encode = Schema.encodeEffect(Schema.toCodecJson(schema))
    const events = stream.pipe(
      Stream.mapEffect((value) => encode(value)),
      Stream.map((json) => `data: ${JSON.stringify(json)}\n\n`),
    )
    const heartbeat = Stream.tick(options.heartbeat ?? "15 seconds").pipe(Stream.map(() => ": heartbeat\n\n"))
    const body = Stream.merge(events, heartbeat, { haltStrategy: "left" }).pipe(
      Stream.tapCause((cause) => Effect.logWarning("Event stream failed", cause)),
      Stream.orDie,
      Stream.encodeText,
      Stream.provideContext(context),
    )
    return HttpServerResponse.stream(body, {
      contentType: "text/event-stream",
      headers: { "cache-control": "no-cache", "x-accel-buffering": "no" },
    })
  })
