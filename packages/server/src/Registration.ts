import { type AppManifest, AppRegistration } from "@mosaik/platform/contract"
import { PlatformClient } from "@mosaik/platform/server"
import { Config, Context, Deferred, Effect, Layer, Option, Schedule } from "effect"

/**
 * Registers the app's manifest (metadata, permissions, notification types) with the
 * platform, and for a standalone app its public address (`MOSAIK_PUBLIC_URL`). Runs in the
 * background with retries, so an app can start before the platform.
 */
export class Registration extends Context.Service<
  Registration,
  {
    /** Completes once the manifest is registered (or was rejected). */
    readonly done: Effect.Effect<void>
  }
>()("@mosaik/server/Registration") {
  static readonly layer = (manifest: AppManifest) =>
    Layer.effect(
      Registration,
      Effect.gen(function* () {
        const client = yield* PlatformClient
        const publicUrl = yield* Config.option(Config.String("MOSAIK_PUBLIC_URL"))
        const done = yield* Deferred.make<void>()

        const registration = new AppRegistration({ manifest, publicUrl: Option.getOrNull(publicUrl) })
        yield* client.app.register({ payload: registration }).pipe(
          Effect.tapError((error) =>
            error._tag === "BadRequest"
              ? Effect.logError(`Manifest rejected: ${error.message}`)
              : error._tag === "Unauthorized"
                ? Effect.logError("The platform refused the app's key (MOSAIK_APP_KEY): is the app installed?")
                : Effect.logWarning(`Platform not reachable yet (${error._tag}), retrying registration`),
          ),
          Effect.retry({
            while: (error) => error._tag !== "BadRequest" && error._tag !== "Unauthorized",
            schedule: Schedule.min([Schedule.exponential("500 millis"), Schedule.spaced("30 seconds")]),
          }),
          Effect.tap(() => Effect.logInfo(`Registered app "${manifest.id}"`)),
          Effect.ignore,
          Effect.andThen(Deferred.succeed(done, undefined)),
          Effect.withSpan("Registration.register"),
          Effect.forkScoped,
        )

        return Registration.of({ done: Deferred.await(done) })
      }),
    )
}
