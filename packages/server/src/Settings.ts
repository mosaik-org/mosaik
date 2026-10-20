import type { App, PlatformEventType, SettingsSpec, SettingValue, SettingValues } from "@mosaik/core"
import { settingValue } from "@mosaik/core"
import { type AppSettingsSnapshot, MAX_EVENTS_WAIT_SECONDS } from "@mosaik/platform/contract"
import { PlatformClient } from "@mosaik/platform/server"
import { Context, Duration, Effect, Layer, Schedule, type Schema, Stream, SubscriptionRef } from "effect"

/** How long the app waits for its settings at startup before starting with what it has (the defaults). */
const STARTUP_WAIT = Duration.seconds(5)

/** The longest the app waits between attempts while the platform cannot be reached. */
const MAX_BACKOFF = Duration.minutes(1)

type Stored = Readonly<Record<string, Schema.Json>>

/** The app's settings as declared in its manifest, typed: see {@link Settings.for}. */
export interface AppSettingsReader<S extends SettingsSpec> {
  /** The setting's current value: what its owners chose, or its default. */
  get<K extends keyof S & string>(name: K): Effect.Effect<SettingValue<S[K]>>
  /** Every setting's current value. */
  readonly all: Effect.Effect<SettingValues<S>>
  /**
   * Every setting's value: the current ones, then again each time an owner changes one, for what
   * must react (a cache, a schedule).
   */
  readonly changes: Stream.Stream<SettingValues<S>>
}

type SettingsOf<D> = D extends App<string, string, string, PlatformEventType, infer S> ? S : never

/**
 * The app's settings (`settings` in its manifest, declared with `Setting`): how it behaves,
 * changed by its owners and admins in the app's management page while it runs. Read them when
 * needed rather than once at startup: changes arrive without a restart.
 *
 * The values come from the platform, which the app keeps asking for changes (like events).
 * When it cannot be reached, the app keeps the last values it had (the defaults before the
 * first answer) and tries again; a stored value that does not fit the manifest (it changed
 * since) gives way to the default.
 *
 * @example
 * const settings = yield* Settings.for(sales)
 * const limit = yield* settings.get("refundLimit") // number
 */
export class Settings extends Context.Service<
  Settings,
  {
    /** The values stored on the platform (unchecked), by name. */
    readonly stored: SubscriptionRef.SubscriptionRef<Stored>
  }
>()("@mosaik/server/Settings") {
  /** Follows the app's settings on the platform, from the moment the app starts. */
  static readonly layer = Layer.effect(
    Settings,
    Effect.gen(function* () {
      const client = yield* PlatformClient
      const stored = yield* SubscriptionRef.make<Stored>({})
      let version: number | undefined

      const apply = (snapshot: AppSettingsSnapshot) =>
        Effect.gen(function* () {
          if (snapshot.version === version) return
          version = snapshot.version
          yield* SubscriptionRef.set(stored, snapshot.values)
        })

      // A first answer before serving requests, when it comes quickly; the defaults otherwise.
      yield* client.app.settings({ query: {} }).pipe(
        Effect.flatMap(apply),
        Effect.timeout(STARTUP_WAIT),
        Effect.catchCause((cause) => Effect.logWarning("Starting with the default settings", cause)),
      )

      const backoff = Schedule.min([Schedule.exponential("1 second"), Schedule.spaced(MAX_BACKOFF)])
      yield* Effect.suspend(() =>
        client.app.settings({
          query: version === undefined ? {} : { after: version, wait: MAX_EVENTS_WAIT_SECONDS },
        }),
      ).pipe(
        Effect.flatMap(apply),
        Effect.tapError((error) => Effect.logWarning(`Could not fetch settings (${error._tag}), retrying`)),
        Effect.retry(backoff),
        Effect.forever,
        Effect.forkScoped,
      )

      return Settings.of({ stored })
    }),
  )

  /** The settings of `app`, typed by its manifest. */
  static readonly for = <D extends App<string, string, string, PlatformEventType, SettingsSpec>>(
    app: D,
  ): Effect.Effect<AppSettingsReader<SettingsOf<D>>, never, Settings> =>
    Effect.gen(function* () {
      const { stored } = yield* Settings
      return reader(app.settings as SettingsOf<D>, stored)
    })
}

/** Values as the app reads them: the stored ones that fit, defaults for the rest. */
const valuesOf = <S extends SettingsSpec>(settings: S, stored: Stored): SettingValues<S> =>
  Object.fromEntries(
    Object.entries(settings).map(([name, setting]) => [name, settingValue(setting, stored[name])]),
  ) as SettingValues<S>

const reader = <S extends SettingsSpec>(
  settings: S,
  stored: SubscriptionRef.SubscriptionRef<Stored>,
): AppSettingsReader<S> => ({
  get: (name) =>
    Effect.map(SubscriptionRef.get(stored), (values) => settingValue(settings[name] as S[typeof name], values[name])),
  all: Effect.map(SubscriptionRef.get(stored), (values) => valuesOf(settings, values)),
  changes: SubscriptionRef.changes(stored).pipe(Stream.map((values) => valuesOf(settings, values))),
})
