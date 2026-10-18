import { Unauthorized } from "@mosaik/core"
import { AppAuth, CurrentApp } from "@mosaik/platform/contract"
import { Effect, Layer, Option, Redacted } from "effect"
import { Apps } from "./Apps"

/** Server side of {@link AppAuth}: the key identifies the calling app. */
export const AppAuthLive = Layer.effect(
  AppAuth,
  Effect.gen(function* () {
    const apps = yield* Apps
    return AppAuth.of({
      key: Effect.fn("AppAuth")(function* (httpEffect, { credential }) {
        const app = yield* apps.authenticate(Redacted.value(credential))
        if (Option.isNone(app)) return yield* new Unauthorized({ message: "Invalid app key" })
        yield* Effect.annotateCurrentSpan({ "mosaik.app": app.value })
        return yield* Effect.provideService(httpEffect, CurrentApp, CurrentApp.of({ id: app.value }))
      }),
    })
  }),
)
