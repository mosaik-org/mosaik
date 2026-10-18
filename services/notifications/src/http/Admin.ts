import { AuditEventInput } from "@mosaik/auth/contract"
import { InternalClient } from "@mosaik/auth/server"
import { CurrentPrincipal, NotFound } from "@mosaik/core"
import { type Content, NotificationsApi, TestResult } from "@mosaik/notifications/contract"
import { Effect, Option, Schedule, type Schema } from "effect"
import { HttpApiBuilder } from "effect/http-api"
import { Channels } from "../delivery/Channels"
import { Outbox } from "../delivery/Outbox"
import { Routes } from "../targets/Routes"
import { Targets } from "../targets/Targets"

const TEST_MESSAGE: Content = {
  title: "Test message from Mosaik",
  body: "If you can read this, the channel is set up correctly.",
  link: "/",
  severity: "success",
}

export const AdminHandlers = HttpApiBuilder.group(
  NotificationsApi,
  "admin",
  Effect.fn(function* (handlers) {
    const targets = yield* Targets
    const routes = yield* Routes
    const outbox = yield* Outbox
    const channels = yield* Channels
    const auth = yield* InternalClient

    /** Admin changes go to the central audit log, like every other app's actions. */
    const audit = (action: string, target: string, details: Record<string, Schema.Json> = {}) =>
      Effect.gen(function* () {
        const principal = yield* CurrentPrincipal
        yield* auth.internal
          .recordAudit({
            payload: new AuditEventInput({
              app: "notifications",
              action,
              target,
              actor: principal.user,
              details,
            }),
          })
          .pipe(
            Effect.retry({ schedule: Schedule.exponential("200 millis"), times: 3 }),
            Effect.catchCause((cause) => Effect.logError("Failed to record audit entry", action, cause)),
          )
      })

    return handlers.handleAll({
      targets: () => targets.list,

      createTarget: Effect.fn(function* ({ payload }) {
        const target = yield* targets.create(payload)
        yield* audit("targets.create", target.id, { kind: target.kind, name: target.name })
        return target
      }),

      updateTarget: Effect.fn(function* ({ params, payload }) {
        const target = yield* targets.update(params.id, payload)
        yield* audit("targets.update", target.id, {
          name: target.name,
          allowedSources: [...target.allowedSources],
          addressChanged: payload.url !== undefined || payload.channel !== undefined,
        })
        return target
      }),

      deleteTarget: Effect.fn(function* ({ params }) {
        yield* targets.delete(params.id)
        yield* audit("targets.delete", params.id)
      }),

      testTarget: Effect.fn(function* ({ params }) {
        const target = yield* targets.get(params.id)
        if (Option.isNone(target)) return yield* new NotFound({ resource: "target", id: params.id })
        return yield* channels.targets.post(target.value, TEST_MESSAGE, "notifications").pipe(
          Effect.as(new TestResult({ ok: true, error: null })),
          Effect.catch((failure) => Effect.succeed(new TestResult({ ok: false, error: failure.message }))),
        )
      }),

      routes: () => routes.list,

      setRoute: Effect.fn(function* ({ payload }) {
        const rule = yield* routes.set(payload.key, payload.targets)
        yield* audit("routes.set", payload.key, { targets: [...rule.targets] })
        return rule
      }),

      deliveries: ({ query }) => outbox.log(query),

      retryDelivery: Effect.fn(function* ({ params }) {
        yield* outbox.retry(params.id)
        yield* audit("deliveries.retry", String(params.id))
      }),
    })
  }),
)
