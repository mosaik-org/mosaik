import type { AnyApp, App, PlatformEventType } from "@mosaik/core"
import { PlatformEventData } from "@mosaik/core"
import { type AppEvent, MAX_EVENTS_WAIT_SECONDS } from "@mosaik/platform/contract"
import { PlatformClient } from "@mosaik/platform/server"
import { Cause, Context, type DateTime, Duration, Effect, Layer, Schedule, Schema } from "effect"
import { Registration } from "./Registration"

/** About the event being handled. */
export interface EventInfo {
  /** Unique per event. Events can arrive more than once (after a failure): use it to skip repeats. */
  readonly id: string
  readonly occurredAt: DateTime.Utc
}

export type EventHandler<T extends PlatformEventType> = (
  data: PlatformEventData<T>,
  event: EventInfo,
) => Effect.Effect<void, unknown>

/** A handler for every event the app subscribes to. */
export type EventHandlerMap<Event extends PlatformEventType> = { readonly [K in Event]: EventHandler<K> } & {
  /**
   * Some events were removed (after `EVENT_RETENTION_DAYS`) before the app handled them,
   * e.g. after it was disabled for a long time: resynchronize what the app keeps.
   */
  readonly missed?: () => Effect.Effect<void, unknown>
}

type EventsOf<D> = D extends App<string, string, string, infer Event> ? Event : never

/** The app's event handlers; build them with {@link Events.handlers}. */
export class EventHandlers extends Context.Service<
  EventHandlers,
  {
    readonly types: ReadonlyArray<PlatformEventType>
    readonly handle: (event: AppEvent) => Effect.Effect<void, unknown>
    readonly missed: Effect.Effect<void, unknown>
  }
>()("@mosaik/server/EventHandlers") {}

/** How long the consumer waits before trying again after a failure, at most. */
const MAX_BACKOFF = Duration.minutes(1)

/**
 * Platform events (see `PlatformEventType` in `@mosaik/core`), delivered in order, at least once.
 * Subscribe in the manifest (`events: ["user.deleted"]`), handle them here, and pass the
 * layer to `runApp({ ..., events })`.
 *
 * A handler that fails is retried (with backoff) before any later event is handled; admins
 * see the error in Admin → Apps and can skip past it.
 *
 * @example
 * export const EventsLive = Events.handlers(crm, Effect.gen(function* () {
 *   const deals = yield* Deals
 *   return {
 *     "user.deleted": ({ userId }) => deals.unassign(userId),
 *   }
 * })).pipe(Layer.provide(Deals.layer))
 */
export const Events = {
  handlers: <D extends AnyApp, E, R>(
    app: D,
    make: Effect.Effect<EventHandlerMap<EventsOf<D>>, E, R>,
  ): Layer.Layer<EventHandlers, E, R> =>
    Layer.effect(
      EventHandlers,
      Effect.gen(function* () {
        const handlers = (yield* make) as EventHandlerMap<PlatformEventType>
        const types = app.events
        const missing = types.filter((type) => typeof handlers[type] !== "function")
        if (missing.length > 0) return yield* Effect.die(`No handler for subscribed events: ${missing.join(", ")}`)

        return EventHandlers.of({
          types,
          handle: (event) =>
            Effect.gen(function* () {
              const handler = handlers[event.type] as EventHandler<PlatformEventType> | undefined
              if (handler === undefined) return
              const data = yield* Schema.decodeUnknownEffect(PlatformEventData[event.type])(event.data)
              yield* handler(data as never, { id: event.id, occurredAt: event.occurredAt })
            }).pipe(
              Effect.withSpan("Events.handle", { attributes: { "event.type": event.type, "event.id": event.id } }),
            ),
          missed: handlers.missed?.() ?? Effect.void,
        })
      }),
    ),
}

const describe = (cause: Cause.Cause<unknown>) => Cause.pretty(cause).split("\n")[0]?.slice(0, 500) ?? "Failed"

/**
 * Fetches the app's events (waiting for new ones), hands them to the handlers in order
 * and acknowledges them. A failed handler is reported to the platform and retried.
 */
export const EventConsumer = Layer.effectDiscard(
  Effect.gen(function* () {
    const client = yield* PlatformClient
    const registration = yield* Registration
    const handlers = yield* EventHandlers

    const ack = (position: number, error: string | null) => client.app.ackEvents({ payload: { position, error } })

    /** One batch: returns whether every event was handled. */
    const round = Effect.gen(function* () {
      const batch = yield* client.app.events({ query: { wait: MAX_EVENTS_WAIT_SECONDS } })
      if (batch.missed) {
        yield* Effect.logWarning("Some platform events were removed before the app handled them")
        // Not retried: the events are gone either way.
        yield* handlers.missed.pipe(
          Effect.catchCause((cause) => Effect.logError("Resynchronizing after missed events failed", cause)),
        )
      }
      let handled: number | null = null
      for (const event of batch.events) {
        const exit = yield* Effect.exit(handlers.handle(event))
        if (exit._tag === "Failure") {
          const message = `${event.type} (${event.id}): ${describe(exit.cause)}`
          yield* Effect.logError("Event handler failed, will retry", exit.cause)
          yield* ack(handled ?? 0, message)
          return false
        }
        handled = event.position
      }
      if (handled !== null) yield* ack(handled, null)
      return true
    })

    yield* registration.done
    yield* Effect.logInfo("Receiving platform events", { types: handlers.types })

    // Back off while failing (a handler or the platform), and start over once a round succeeds.
    const backoff = Schedule.min([Schedule.exponential("1 second"), Schedule.spaced(MAX_BACKOFF)])
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
