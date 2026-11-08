import { Audiences, Notify } from "@mosaik/server"
import { Config, Context, DateTime, Duration, Effect, Layer, Schedule, type Stream, SubscriptionRef } from "effect"
import { HttpClient } from "effect/http"
import { type ServiceState, ServiceStatus, StatusSnapshot } from "../api"
import { status } from "../manifest"

const HISTORY = 40
const SLOW = Duration.millis(500)
const TIMEOUT = Duration.seconds(3)

interface Target {
  readonly name: string
  readonly url: URL
}

/**
 * `STATUS_TARGETS=gateway=http://gateway:3000/health,...` (explicit health URLs), or by default
 * the `/health` endpoint of every service in `MOSAIK_SERVICES=name=baseUrl,...` (set by the dev
 * runner and docker compose).
 */
const parseList = (raw: string) =>
  raw
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map((entry) => {
      const [name = "", url = ""] = entry.split("=", 2)
      return { name, url }
    })

const TargetsConfig = Config.all({
  explicit: Config.String("STATUS_TARGETS").pipe(Config.withDefault("")),
  services: Config.String("MOSAIK_SERVICES").pipe(Config.withDefault("")),
}).pipe(
  Config.map(
    ({ explicit, services }): ReadonlyArray<Target> =>
      explicit.length > 0
        ? parseList(explicit).map(({ name, url }) => ({ name, url: new URL(url) }))
        : parseList(services).map(({ name, url }) => ({ name, url: new URL("/health", url) })),
  ),
)

export interface Transition {
  readonly name: string
  readonly change: "down" | "recovered"
}

const isHealthy = (state: ServiceState) => state === "up" || state === "degraded"

/** Services that went down (from a known healthy state) or came back up. Startup (`unknown`) is not a change. */
export const transitions = (
  previous: ReadonlyArray<ServiceStatus>,
  next: ReadonlyArray<ServiceStatus>,
): ReadonlyArray<Transition> =>
  next.flatMap((service): Array<Transition> => {
    const before = previous.find((s) => s.name === service.name)?.state ?? "unknown"
    if (isHealthy(before) && service.state === "down") return [{ name: service.name, change: "down" }]
    if (before === "down" && isHealthy(service.state)) return [{ name: service.name, change: "recovered" }]
    return []
  })

/**
 * Polls every target's health endpoint on an interval and keeps the latest snapshot
 * (with a short latency history) in a `SubscriptionRef`, so any number of live
 * subscribers share one polling loop.
 */
export class Monitor extends Context.Service<
  Monitor,
  {
    readonly snapshot: Effect.Effect<StatusSnapshot>
    readonly changes: Stream.Stream<StatusSnapshot>
  }
>()("@mosaik/status/Monitor") {
  static readonly layer = Layer.effect(
    Monitor,
    Effect.gen(function* () {
      const targets = yield* TargetsConfig
      const interval = yield* Config.Duration("STATUS_INTERVAL").pipe(Config.withDefault(Duration.seconds(5)))
      const client = (yield* HttpClient.HttpClient).pipe(HttpClient.filterStatusOk)
      const notify = yield* Notify

      /**
       * Alerts holders of `status:alerts` (notification failures are logged by `Notify`). One item per
       * service: its recovery updates the item, then resolves it.
       */
      const alert = (transition: Transition) =>
        notify
          .send({
            type: status.notification("service.down"),
            audience: Audiences.permission(status.perm("alerts")),
            subject: `service:${transition.name}`,
            content:
              transition.change === "down"
                ? {
                    title: `${transition.name} is down`,
                    body: `The ${transition.name} service stopped answering its health check.`,
                    link: "/status",
                    severity: "critical",
                  }
                : {
                    title: `${transition.name} recovered`,
                    body: `The ${transition.name} service is answering its health check again.`,
                    link: "/status",
                    severity: "success",
                  },
          })
          .pipe(
            Effect.andThen(
              transition.change === "recovered" ? notify.resolve(`service:${transition.name}`) : Effect.void,
            ),
            Effect.ignore,
          )

      const ref = yield* SubscriptionRef.make(
        new StatusSnapshot({
          services: targets.map(
            (t) => new ServiceStatus({ name: t.name, state: "unknown", latencyMs: null, history: [], checkedAt: null }),
          ),
        }),
      )

      const check = (target: Target, previous: ServiceStatus | undefined) =>
        Effect.gen(function* () {
          const result = yield* client.get(target.url).pipe(Effect.timeout(TIMEOUT), Effect.timed, Effect.result)
          const latency = result._tag === "Success" ? Duration.toMillis(result.success[0]) : null
          const state =
            latency === null ? "down" : Duration.isGreaterThan(Duration.millis(latency), SLOW) ? "degraded" : "up"
          return new ServiceStatus({
            name: target.name,
            state,
            latencyMs: latency === null ? null : Math.round(latency),
            history: [...(previous?.history ?? []), latency === null ? null : Math.round(latency)].slice(-HISTORY),
            checkedAt: yield* DateTime.now,
          })
        })

      const round = Effect.gen(function* () {
        const current = yield* SubscriptionRef.get(ref)
        const services = yield* Effect.forEach(
          targets,
          (target) =>
            check(
              target,
              current.services.find((s) => s.name === target.name),
            ),
          { concurrency: "unbounded" },
        )
        yield* SubscriptionRef.set(ref, new StatusSnapshot({ services }))
        yield* Effect.forEach(transitions(current.services, services), alert, { discard: true })
      }).pipe(Effect.withSpan("Monitor.round"))

      if (targets.length === 0) yield* Effect.logWarning("STATUS_TARGETS is empty; nothing to monitor")
      yield* round.pipe(Effect.repeat(Schedule.spaced(interval)), Effect.forkScoped)

      return Monitor.of({
        snapshot: SubscriptionRef.get(ref),
        changes: SubscriptionRef.changes(ref),
      })
    }),
  )
}
