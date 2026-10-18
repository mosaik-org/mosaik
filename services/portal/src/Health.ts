import type { AppHealth } from "@mosaik/portal/contract"
import { Context, DateTime, Duration, Effect, Layer, Schedule } from "effect"
import { CoreClient } from "./clients"

const CHECK_EVERY = Duration.seconds(15)

export interface HealthState {
  readonly health: AppHealth
  /** When the app last answered its health check. */
  readonly lastSeenAt: DateTime.Utc | null
}

const UNKNOWN: HealthState = { health: "unknown", lastSeenAt: null }

/**
 * Whether apps answer: every app Core routes is asked for `/health` regularly. Kept in
 * memory, since it is only ever current; after a restart it is known again within seconds.
 */
export class Health extends Context.Service<
  Health,
  {
    of(appId: string): HealthState
    /** Asks the app now (e.g. right after its container started). */
    check(appId: string, upstream: string): Effect.Effect<void>
  }
>()("@mosaik/portal-service/Health") {
  static readonly layer = Layer.effect(
    Health,
    Effect.gen(function* () {
      const core = yield* CoreClient
      const states = new Map<string, HealthState>()

      const check = (appId: string, upstream: string) =>
        Effect.tryPromise({
          try: () => fetch(new URL("/health", upstream), { signal: AbortSignal.timeout(3000) }),
          catch: () => "unreachable",
        }).pipe(
          Effect.map((response) => response.ok),
          Effect.orElseSucceed(() => false),
          Effect.flatMap((healthy) =>
            Effect.map(DateTime.now, (now) => {
              const previous = states.get(appId) ?? UNKNOWN
              states.set(
                appId,
                healthy
                  ? { health: "healthy", lastSeenAt: now }
                  : { health: "unhealthy", lastSeenAt: previous.lastSeenAt },
              )
            }),
          ),
        )

      const checkAll = Effect.gen(function* () {
        const apps = yield* core.registry.list()
        const routed = apps.filter((app) => app.upstream !== null && app.status !== "disabled")
        for (const id of states.keys()) if (!routed.some((app) => app.id === id)) states.delete(id)
        yield* Effect.forEach(routed, (app) => check(app.id, app.upstream ?? ""), { concurrency: 10, discard: true })
      }).pipe(Effect.withSpan("Health.checkAll"))

      yield* checkAll.pipe(
        Effect.catchCause((cause) => Effect.logWarning("Health checks failed", cause)),
        Effect.repeat(Schedule.spaced(CHECK_EVERY)),
        Effect.forkScoped,
      )

      return Health.of({ of: (appId) => states.get(appId) ?? UNKNOWN, check })
    }),
  )
}
