import { NOTIFICATION_LINK_PAGE } from "@mosaik/notifications/contract"
import { Duration, Effect, Layer, Option } from "effect"
import { NotificationsConfig } from "../NotificationsConfig"
import { retryDelay } from "./Backoff"
import { Channels } from "./Channels"
import type { OutgoingDelivery } from "./channels/Channel"
import { Outbox } from "./Outbox"

const BATCH = 20
const CONCURRENCY = 5
/** Picks up retries and deliveries queued by other instances. */
const POLL = Duration.seconds(5)

/**
 * A notification about a subject, sent to a person, links through Core's page for it: an e-mail cannot
 * be taken back, so the page says who resolved it before anyone does the work twice. A channel admins
 * route it to keeps the link as it is, as its readers did not receive it as people.
 */
export const linkedThroughCore = (delivery: OutgoingDelivery): OutgoingDelivery =>
  delivery.category === "notification" &&
  delivery.subject !== null &&
  delivery.channel !== "target" &&
  delivery.content.link !== undefined
    ? { ...delivery, content: { ...delivery.content, link: `${NOTIFICATION_LINK_PAGE}?message=${delivery.messageId}` } }
    : delivery

/**
 * Sends due deliveries in the background: woken right after a message is queued and
 * every few seconds for retries. Failed attempts are retried with backoff up to
 * `DELIVERY_MAX_ATTEMPTS`; permanent failures are not retried.
 */
export const layer = Layer.effectDiscard(
  Effect.gen(function* () {
    const outbox = yield* Outbox
    const channels = yield* Channels
    const config = yield* NotificationsConfig

    const deliver = (delivery: OutgoingDelivery) =>
      Effect.gen(function* () {
        const channel = channels.get(delivery.channel)
        if (Option.isNone(channel)) {
          yield* Effect.logWarning(`Channel "${delivery.channel}" is not configured`, { delivery: delivery.id })
          return yield* outbox.markFailed(delivery.id, `Channel "${delivery.channel}" is not configured`, Option.none())
        }
        const result = yield* Effect.result(channel.value.send(linkedThroughCore(delivery)))
        if (result._tag === "Success") {
          return yield* outbox.markSent(delivery.id, result.success.providerId)
        }
        const failure = result.failure
        const retry = !failure.permanent && delivery.attempts < config.maxAttempts
        const retryIn = retry ? Option.some(retryDelay(delivery.attempts)) : Option.none()
        yield* Effect.logWarning(retry ? "Delivery failed, will retry" : "Delivery failed", {
          delivery: delivery.id,
          message: delivery.messageId,
          channel: delivery.channel,
          attempt: delivery.attempts,
          error: failure.message,
          ...(Option.isSome(retryIn) ? { retryIn: Duration.format(retryIn.value) } : {}),
        })
        yield* outbox.markFailed(delivery.id, failure.message, retryIn)
      }).pipe(
        Effect.withSpan("Worker.deliver", {
          attributes: {
            "mosaik.delivery.id": delivery.id,
            "mosaik.delivery.channel": delivery.channel,
            "mosaik.message.source": delivery.source,
          },
        }),
      )

    /** Sends everything that is due, batch by batch. */
    const drain = Effect.gen(function* () {
      while (true) {
        const batch = yield* outbox.claim(BATCH)
        yield* Effect.forEach(batch, deliver, { concurrency: CONCURRENCY, discard: true })
        if (batch.length < BATCH) return
      }
    })

    yield* drain.pipe(
      Effect.catchCause((cause) => Effect.logError("Delivery round failed", cause)),
      Effect.andThen(Effect.raceFirst(outbox.woken, Effect.sleep(POLL))),
      Effect.forever,
      Effect.forkScoped,
    )
  }),
)
