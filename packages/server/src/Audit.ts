import { CurrentPrincipal } from "@mosaik/core"
import { AuditRequest } from "@mosaik/platform/contract"
import { PlatformClient } from "@mosaik/platform/server"
import { Context, Effect, Layer, Option, Schedule, type Schema } from "effect"

export interface AuditEntry {
  /** What happened, e.g. `orders.refund`. */
  readonly action: string
  /** What it happened to, e.g. an order id. */
  readonly target?: string
  readonly details?: Record<string, Schema.Json>
}

/**
 * Central audit log. Entries are attributed to the app (by the platform) and to the
 * current principal (when there is one), so the admin panel can show activity across apps.
 *
 * Recording never fails the calling action: delivery is retried and failures are logged.
 */
export class Audit extends Context.Service<Audit, { record(entry: AuditEntry): Effect.Effect<void> }>()(
  "@mosaik/server/Audit",
) {
  static readonly layer = Layer.effect(
    Audit,
    Effect.gen(function* () {
      const client = yield* PlatformClient
      return Audit.of({
        record: Effect.fn("Audit.record")(function* (entry: AuditEntry) {
          const principal = yield* Effect.serviceOption(CurrentPrincipal)
          const payload = new AuditRequest({
            action: entry.action,
            target: entry.target ?? null,
            actor: Option.match(principal, { onNone: () => null, onSome: (p) => p.user }),
            details: entry.details ?? {},
          })
          yield* client.app.audit({ payload }).pipe(
            Effect.retry({ schedule: Schedule.exponential("200 millis"), times: 3 }),
            Effect.catchCause((cause) => Effect.logError("Failed to record audit entry", entry, cause)),
          )
        }),
      })
    }),
  )
}
