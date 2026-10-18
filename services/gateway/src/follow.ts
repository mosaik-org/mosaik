import { INTERNAL_KEY_HEADER } from "@mosaik/auth/contract"
import { Data, Duration, Effect, Redacted, Schedule, type Schema, Stream } from "effect"
import { Sse } from "effect/encoding"
import { HttpClient, HttpClientRequest } from "effect/http"

/** The streams the gateway follows send a heartbeat every 20 seconds; silence this long means the connection is dead. */
const STREAM_IDLE = Duration.seconds(45)

class StreamError extends Data.TaggedError("StreamError")<{ readonly message: string }> {}

/**
 * Follows a platform service's Server-Sent Events stream (`url`, with the internal key) for
 * as long as the scope lives: `onEvent` gets every event, decoded with `schema`. When the
 * connection drops, it connects again; the streams start with the current state, so
 * nothing missed in between is lost.
 */
export const followEventStream = <S extends Schema.Codec<any, any>>(options: {
  readonly name: string
  readonly url: URL
  readonly key: Redacted.Redacted<string>
  readonly schema: S
  readonly onEvent: (event: S["Type"]) => Effect.Effect<void>
}) =>
  Effect.gen(function* () {
    const client = yield* HttpClient.HttpClient
    const request = HttpClientRequest.get(options.url).pipe(
      HttpClientRequest.setHeader(INTERNAL_KEY_HEADER, Redacted.value(options.key)),
    )
    const follow = client.execute(request).pipe(
      Effect.flatMap((response) =>
        response.status === 200
          ? Effect.succeed(response.stream)
          : Effect.fail(new StreamError({ message: `HTTP ${response.status}` })),
      ),
      Stream.unwrap,
      Stream.decodeText,
      Stream.timeoutOrElse({
        duration: STREAM_IDLE,
        orElse: () => Stream.fail(new StreamError({ message: "No heartbeat" })),
      }),
      Stream.pipeThroughChannel(Sse.decodeDataSchema(options.schema)),
      Stream.runForEach((event) => options.onEvent(event.data)),
      Effect.andThen(Effect.fail(new StreamError({ message: "The stream was closed" }))),
    )
    yield* follow.pipe(
      Effect.tapError((error) =>
        Effect.logWarning(
          `${options.name} stream interrupted (${"message" in error ? error.message : error._tag}), reconnecting`,
        ),
      ),
      Effect.retry(Schedule.min([Schedule.exponential("200 millis"), Schedule.spaced("5 seconds")])),
      Effect.forkScoped,
    )
  })
