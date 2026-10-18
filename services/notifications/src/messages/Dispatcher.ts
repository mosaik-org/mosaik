import { BadRequest } from "@mosaik/core"
import { MessageAccepted, type MessageRequest, RateLimited } from "@mosaik/notifications/contract"
import { Context, Duration, Effect, Layer, Option } from "effect"
import { RateLimiter } from "effect/persistence"
import { Channels } from "../delivery/Channels"
import { Outbox, type Recipient } from "../delivery/Outbox"
import { NotificationsConfig } from "../NotificationsConfig"
import { Routes } from "../targets/Routes"
import { Targets } from "../targets/Targets"
import { Directory } from "./Directory"

/**
 * Accepts messages from other services: checks idempotency, the e-mail domain policy,
 * target permissions and the per-source rate limit, resolves users to addresses, adds
 * the targets admins routed the kind to, and queues one delivery per distinct recipient.
 */
export class Dispatcher extends Context.Service<
  Dispatcher,
  { dispatch(request: MessageRequest): Effect.Effect<MessageAccepted, BadRequest | RateLimited> }
>()("@mosaik/notifications-service/Dispatcher") {
  static readonly layer = Layer.effect(
    Dispatcher,
    Effect.gen(function* () {
      const config = yield* NotificationsConfig
      const outbox = yield* Outbox
      const channels = yield* Channels
      const directory = yield* Directory
      const targets = yield* Targets
      const routes = yield* Routes
      const limiter = yield* RateLimiter.make.pipe(Effect.provide(RateLimiter.layerStoreMemory))

      const resolve = Effect.fn("Dispatcher.resolve")(function* (request: MessageRequest) {
        const emails = request.to.filter((d) => d._tag === "Email")
        const rejected = emails.filter((d) => !config.allowedDomains.allows(d.address))
        if (rejected.length > 0) {
          return yield* new BadRequest({
            message: `E-mail domain not allowed: ${rejected.map((d) => d.address).join(", ")} (allowed: ${config.allowedDomains.description})`,
          })
        }

        const users = yield* directory.users(request.to.flatMap((d) => (d._tag === "User" ? [d.userId] : [])))

        const explicitTargets = [...new Set(request.to.flatMap((d) => (d._tag === "Target" ? [d.targetId] : [])))]
        for (const id of explicitTargets) {
          const target = yield* targets.get(id)
          if (Option.isNone(target)) return yield* new BadRequest({ message: `Unknown target "${id}"` })
          const allowed = target.value.allowedSources
          if (allowed.length > 0 && !allowed.includes(request.source)) {
            return yield* new BadRequest({
              message: `Target "${id}" does not accept messages from "${request.source}"`,
            })
          }
        }
        // Routing is admin configuration, so routed targets need no permission check.
        const routed = request.kind === null ? [] : yield* routes.targetsFor(`${request.source}:${request.kind}`)

        // One delivery per address; a user's name and id win over a bare address.
        const recipients = new Map<string, Recipient>()
        for (const user of users) {
          recipients.set(`email:${user.email.toLowerCase()}`, {
            channel: "email",
            address: user.email,
            name: user.name,
            userId: user.id,
          })
        }
        for (const email of emails) {
          const key = `email:${email.address.toLowerCase()}`
          if (!recipients.has(key)) {
            recipients.set(key, { channel: "email", address: email.address, name: email.name ?? null, userId: null })
          }
        }
        for (const id of new Set([...explicitTargets, ...routed])) {
          recipients.set(`target:${id}`, { channel: "target", address: id, name: null, userId: null })
        }
        return [...recipients.values()]
      })

      const consume = (source: string, deliveries: number) =>
        limiter
          .consume({
            key: `messages:${source}`,
            limit: config.deliveriesPerMinute,
            window: "1 minute",
            tokens: deliveries,
          })
          .pipe(
            Effect.catchTag("RateLimiterError", (error) =>
              error.reason._tag === "RateLimitExceeded"
                ? Effect.fail(
                    new RateLimited({
                      message: `Rate limit of ${config.deliveriesPerMinute} deliveries per minute exceeded`,
                      retryAfterMs: Duration.toMillis(error.reason.retryAfter),
                    }),
                  )
                : Effect.die(error),
            ),
          )

      return Dispatcher.of({
        dispatch: Effect.fn("Dispatcher.dispatch")(function* (request: MessageRequest) {
          yield* Effect.annotateCurrentSpan({
            "mosaik.message.source": request.source,
            "mosaik.message.kind": request.kind,
          })
          if (request.to.length === 0 && request.kind === null) {
            return yield* new BadRequest({ message: "A message needs destinations or a kind to route" })
          }
          if (request.idempotencyKey !== null) {
            const existing = yield* outbox.findByIdempotencyKey(request.source, request.idempotencyKey)
            if (Option.isSome(existing)) {
              return new MessageAccepted({
                id: existing.value.id,
                deliveries: existing.value.deliveries,
                duplicate: true,
              })
            }
          }

          const recipients = yield* resolve(request)
          if (recipients.some((r) => r.channel === "email") && !channels.has("email")) {
            return yield* new BadRequest({ message: "E-mail delivery is not configured" })
          }
          if (recipients.length > 0) yield* consume(request.source, recipients.length)

          const queued = yield* outbox.enqueue({
            category: "message",
            source: request.source,
            kind: request.kind,
            content: request.content,
            idempotencyKey: request.idempotencyKey,
            recipients,
            inbox: [],
          })
          if (!queued.duplicate) {
            if (queued.deliveries > 0) yield* outbox.wake
            yield* queued.deliveries > 0
              ? Effect.logInfo("Queued message", {
                  id: queued.id,
                  source: request.source,
                  kind: request.kind,
                  deliveries: queued.deliveries,
                })
              : Effect.logWarning("Message has no destinations (nothing routed for its kind)", {
                  id: queued.id,
                  key: `${request.source}:${request.kind}`,
                })
          }
          return new MessageAccepted({ id: queued.id, deliveries: queued.deliveries, duplicate: queued.duplicate })
        }),
      })
    }),
  )
}
