import { BunHttpServer, BunRuntime } from "@effect/platform-bun"
import { Config, Effect, Layer } from "effect"
import { HttpMiddleware, HttpRouter, HttpServerResponse } from "effect/http"
import * as Observability from "./Observability"

// Health checks run every few seconds; keep them out of the request log.
const HealthRoute = HttpRouter.add(
  "GET",
  "/health",
  HttpMiddleware.withLoggerDisabled(Effect.succeed(HttpServerResponse.text("ok"))),
)

export interface ServeOptions {
  /** Service name used in logs and traces. */
  readonly name: string
  /** Default port; overridden by `PORT`. */
  readonly port?: number
}

/**
 * Serves HTTP routes with Bun, plus a `/health` route, structured logging, tracing
 * and graceful shutdown. Shared by the gateway, the auth service and every app.
 */
export const serve = <E, R>(routes: Layer.Layer<never, E, R>, options: ServeOptions) =>
  HttpRouter.serve(Layer.mergeAll(routes, HealthRoute)).pipe(
    Layer.provide(
      BunHttpServer.layerConfig({
        port: Config.Port("PORT").pipe(Config.withDefault(options.port ?? 3000)),
        hostname: Config.String("HOST").pipe(Config.withDefault("0.0.0.0")),
        // Bun closes connections idle for 10s by default, which cuts quiet event streams
        // (`Live.eventStream` heartbeats every 15s). Bun's maximum is 255.
        idleTimeout: Config.succeed(60),
      }),
    ),
    Layer.provide(Observability.layer(options.name)),
  )

/** Process entrypoint: runs the layer until SIGINT/SIGTERM, then shuts down gracefully. */
export const runMain = <E>(layer: Layer.Layer<never, E>): void =>
  BunRuntime.runMain(Layer.launch(layer).pipe(Effect.tapCause((cause) => Effect.logError("Service crashed", cause))))
