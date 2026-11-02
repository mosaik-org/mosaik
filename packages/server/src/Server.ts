import { BunHttpServer, BunRuntime } from "@effect/platform-bun"
import { Config, Effect, Layer } from "effect"
import { HttpMiddleware, HttpRouter, HttpServerResponse } from "effect/http"
import { HttpApiError } from "effect/http-api"
import * as Observability from "./Observability"

// Health checks run every few seconds; keep them out of the request log.
const HealthRoute = HttpRouter.add(
  "GET",
  "/health",
  HttpMiddleware.withLoggerDisabled(Effect.succeed(HttpServerResponse.text("ok"))),
)

/**
 * Requests an API refuses because they do not match its contract (a missing field, a value out of
 * range) get a `BadRequest` saying what is wrong. Effect answers them with an empty 400, which tells
 * nobody what to fix: not a team calling the API, nor an AI client calling it as a tool.
 */
const DescribeInvalidRequests = HttpRouter.middleware(
  (httpEffect) =>
    httpEffect.pipe(
      Effect.catchDefect((defect) =>
        HttpApiError.HttpApiSchemaError.is(defect) && defect.kind !== "Body" && defect.kind !== "ResponseHeaders"
          ? Effect.succeed(
              HttpServerResponse.jsonUnsafe(
                { _tag: "BadRequest", message: `Invalid ${defect.kind.toLowerCase()}: ${defect.cause.message}` },
                { status: 400 },
              ),
            )
          : Effect.die(defect),
      ),
    ),
  { global: true },
)

export interface ServeOptions {
  /** Service name used in logs and traces. */
  readonly name: string
  /** Default port; overridden by `PORT`. */
  readonly port?: number
  /** The largest request body accepted, in bytes; Bun's default is 128 MB. */
  readonly maxRequestBodySize?: number
}

/**
 * Serves HTTP routes with Bun, plus a `/health` route, structured logging, tracing
 * and graceful shutdown. Shared by the gateway, the auth service and every app.
 */
export const serve = <E, R>(routes: Layer.Layer<never, E, R>, options: ServeOptions) =>
  HttpRouter.serve(Layer.mergeAll(routes, HealthRoute, DescribeInvalidRequests)).pipe(
    Layer.provide(
      BunHttpServer.layerConfig({
        port: Config.Port("PORT").pipe(Config.withDefault(options.port ?? 3000)),
        hostname: Config.String("HOST").pipe(Config.withDefault("0.0.0.0")),
        // Bun closes connections idle for 10s by default, which cuts quiet event streams
        // (`Live.eventStream` heartbeats every 15s). Bun's maximum is 255.
        idleTimeout: Config.succeed(60),
        ...(options.maxRequestBodySize === undefined
          ? {}
          : { maxRequestBodySize: Config.succeed(options.maxRequestBodySize) }),
      }),
    ),
    Layer.provide(Observability.layer(options.name)),
  )

/** Process entrypoint: runs the layer until SIGINT/SIGTERM, then shuts down gracefully. */
export const runMain = <E>(layer: Layer.Layer<never, E>): void =>
  BunRuntime.runMain(Layer.launch(layer).pipe(Effect.tapCause((cause) => Effect.logError("Service crashed", cause))))
