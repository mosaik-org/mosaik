import { InternalClient } from "@mosaik/auth/server"
import { toManifestPayload } from "@mosaik/core"
import { portalApp } from "@mosaik/portal/contract"
import { Effect, Layer, Schedule } from "effect"

/**
 * Registers the Portal's permissions with Core, as an app's backend registers its manifest,
 * so `portal:apps.manage` can be given in roles. In the background, retried until Core answers.
 */
export const Bootstrap = Layer.effectDiscard(
  Effect.gen(function* () {
    const auth = yield* InternalClient
    yield* auth.internal.registerApp({ payload: toManifestPayload(portalApp) }).pipe(
      Effect.tapError((error) => Effect.logWarning(`Core not reachable yet (${error._tag}), retrying`)),
      Effect.retry(Schedule.min([Schedule.exponential("500 millis"), Schedule.spaced("30 seconds")])),
      Effect.tap(() => Effect.logInfo("Registered the Portal's permissions")),
      Effect.ignore,
      Effect.forkScoped,
    )
  }),
)
