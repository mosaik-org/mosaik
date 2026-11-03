import type {
  App,
  PlatformEventType,
  SettingsSpec,
  StatusAudience,
  StatusesSpec,
  StatusKind,
  StatusValue,
} from "@mosaik/core"
import { RUNNING_STATUS_TTL_SECONDS, type StatusEntry } from "@mosaik/platform/contract"
import { PlatformClient } from "@mosaik/platform/server"
import { Context, type DateTime, Duration, Effect, Layer, Schedule, Schema } from "effect"
import { Registration } from "./Registration"

export class StatusError extends Schema.TaggedError<StatusError>()("StatusError", {
  /**
   * - `Rejected`: undeclared status, a value of another kind, another app's permission (do not retry)
   * - `Unavailable`: the platform could not be reached
   */
  reason: Schema.Literals(["Rejected", "Unavailable"]),
  message: Schema.String,
}) {}

/** What a status of each kind is set to. */
export interface StatusInputs {
  /** How many things wait (0 clears it). */
  readonly count: number
  /** When the newest thing came. */
  readonly new: DateTime.Utc
  readonly running: { readonly progress?: number; readonly label?: string }
  readonly health: { readonly level: "warning" | "danger"; readonly label: string }
}

const toValue = <K extends StatusKind>(kind: K, input: StatusInputs[K]): StatusValue => {
  switch (kind) {
    case "count":
      return { _tag: "count", count: input as number }
    case "new":
      return { _tag: "new", at: input as DateTime.Utc }
    case "running": {
      const { progress, label } = input as StatusInputs["running"]
      return { _tag: "running", progress: progress ?? null, label: label ?? null }
    }
    default:
      return { _tag: "health", ...(input as StatusInputs["health"]) }
  }
}

type StatusesOf<D> = D extends App<string, string, string, PlatformEventType, SettingsSpec, infer S> ? S : never
type NamesOfKind<S extends StatusesSpec, K extends StatusKind> = {
  [N in keyof S & string]: S[N]["kind"] extends K ? N : never
}[keyof S & string]
type InputOf<S extends StatusesSpec, N extends keyof S> = StatusInputs[S[N]["kind"]]

/**
 * Where a status leads people: a path under the app's address, to the things it is about, e.g.
 * `/orders?status=pending` (its page when left out).
 */
export interface StatusOptions {
  readonly link?: string
}

/** Reports how far running work got: from 0 to 1, with what it is doing now. */
export type ReportProgress = (progress: number, label?: string) => Effect.Effect<void>

/** The app's statuses as declared in its manifest, typed: see {@link Status.for}. */
export interface AppStatusWriter<S extends StatusesSpec> {
  /** Sets the value for an audience: one person, or everyone with one of the app's permissions. */
  set<N extends keyof S & string>(
    name: N,
    audience: StatusAudience,
    value: InputOf<S, N>,
    options?: StatusOptions,
  ): Effect.Effect<void, StatusError>
  clear<N extends keyof S & string>(name: N, audience: StatusAudience): Effect.Effect<void, StatusError>
  /**
   * Sets every value of the status at once, clearing the others: what an app computed from its
   * data, so nothing stale is left (someone whose count dropped to nothing, a permission no longer used).
   */
  replace<N extends keyof S & string>(
    name: N,
    values: ReadonlyArray<readonly [StatusAudience, InputOf<S, N>, StatusOptions?]>,
  ): Effect.Effect<void, StatusError>
  /**
   * Runs `work` while showing it running for the audience: set at the start, renewed while it
   * runs (running work expires unless renewed), cleared at the end however it ends. `work` gets
   * a function to report its progress. Failing to show it never fails the work.
   */
  whileRunning<N extends NamesOfKind<S, "running">, A, E, R>(
    name: N,
    audience: StatusAudience,
    work: (report: ReportProgress) => Effect.Effect<A, E, R>,
    options?: StatusOptions & { readonly label?: string },
  ): Effect.Effect<A, E, R>
}

/** How long `write` waits for the app's manifest to be registered at startup. */
const REGISTRATION_WAIT = Duration.seconds(10)

/** Running work is set again this often, well within the time it expires after. */
const RENEW_EVERY = Duration.seconds(Math.floor(RUNNING_STATUS_TTL_SECONDS / 3))

/**
 * What the app tells people beside its name in Mosaik's navigation (`statuses` in its manifest):
 * things waiting for them, something new, work running, trouble. Values are for one person or for
 * everyone with one of the app's permissions, and show as soon as they are set.
 *
 * @example
 * const status = yield* Status.for(sales)
 * yield* status.set("orders.pending", StatusAudiences.permission(sales.perm("orders.edit")), 3)
 */
export class Status extends Context.Service<
  Status,
  {
    /** Writes values of a status (`replace`: all of them). Unchecked: `Status.for(app)` is the typed way. */
    write(name: string, entries: ReadonlyArray<StatusEntry>, replace: boolean): Effect.Effect<void, StatusError>
  }
>()("@mosaik/server/Status") {
  static readonly layer = Layer.effect(
    Status,
    Effect.gen(function* () {
      const client = yield* PlatformClient
      const registration = yield* Registration

      return Status.of({
        write: Effect.fn("Status.write")(function* (name, entries, replace) {
          // At startup, the manifest declaring it may not be registered yet.
          yield* registration.done.pipe(Effect.timeoutOption(REGISTRATION_WAIT))
          const request = replace
            ? client.app.replaceStatus({ params: { name }, payload: { entries } })
            : client.app.setStatus({ params: { name }, payload: entries[0] as StatusEntry })
          return yield* request.pipe(
            Effect.retry({
              while: (error) => error._tag !== "BadRequest",
              schedule: Schedule.exponential("200 millis"),
              times: 3,
            }),
            Effect.mapError((error) =>
              error._tag === "BadRequest"
                ? new StatusError({ reason: "Rejected", message: error.message })
                : new StatusError({ reason: "Unavailable", message: "Platform unavailable" }),
            ),
            Effect.tapError((error) => Effect.logError(`Failed to set status "${name}"`, error)),
          )
        }),
      })
    }),
  )

  /** The app's statuses, typed by its manifest. */
  static readonly for = <D extends App<string, string, string, PlatformEventType, SettingsSpec, StatusesSpec>>(
    app: D,
  ): Effect.Effect<AppStatusWriter<StatusesOf<D>>, never, Status> =>
    Effect.gen(function* () {
      return statusWriter(app.statuses as StatusesOf<D>, yield* Status)
    })
}

const statusWriter = <S extends StatusesSpec>(declared: S, status: Status["Service"]): AppStatusWriter<S> => {
  const value = <N extends keyof S & string>(name: N, input: InputOf<S, N>) =>
    toValue(declared[name]?.kind as S[N]["kind"], input)

  const set: AppStatusWriter<S>["set"] = (name, audience, input, options) =>
    status.write(name, [{ audience, value: value(name, input), link: options?.link ?? null }], false)
  const clear = (name: string, audience: StatusAudience) =>
    status.write(name, [{ audience, value: null, link: null }], false)

  return {
    set,
    clear,
    replace: (name, values) =>
      status.write(
        name,
        values.map(([audience, input, options]) => ({
          audience,
          value: value(name, input),
          link: options?.link ?? null,
        })),
        true,
      ),
    whileRunning: (name, audience, work, options) =>
      Effect.gen(function* () {
        // Showing it is best effort: the work runs whatever happens to its status.
        let latest: StatusInputs["running"] = options?.label === undefined ? {} : { label: options.label }
        const show = Effect.suspend(() => set(name, audience, latest as InputOf<S, typeof name>, options)).pipe(
          Effect.ignore,
        )
        yield* show
        yield* show.pipe(Effect.delay(RENEW_EVERY), Effect.forever, Effect.forkScoped)
        const report: ReportProgress = (progress, label = latest.label) => {
          latest = label === undefined ? { progress } : { progress, label }
          return show
        }
        return yield* work(report)
      }).pipe(
        // The renewals stop with the scope, before the status is cleared: none can bring it back.
        Effect.scoped,
        Effect.ensuring(clear(name, audience).pipe(Effect.ignore)),
      ),
  }
}
