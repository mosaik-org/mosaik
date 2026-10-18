import { Config, Effect, Layer, Logger, Option } from "effect"
import { FetchHttpClient } from "effect/http"
import { Otlp } from "effect/observability"

/**
 * Logging + tracing for a service.
 * - `NODE_ENV=production` → JSON logs, otherwise pretty logs.
 * - `OTEL_EXPORTER_OTLP_ENDPOINT` set → traces, logs and metrics are exported over OTLP/HTTP (e.g. Jaeger).
 */
export const layer = (serviceName: string) =>
  Layer.unwrap(
    Effect.gen(function* () {
      const env = yield* Config.String("NODE_ENV").pipe(Config.withDefault("development"))
      const endpoint = yield* Config.option(Config.String("OTEL_EXPORTER_OTLP_ENDPOINT")).pipe(
        Config.map(Option.filter((url) => url.length > 0)),
      )

      const console = Logger.layer([env === "production" ? Logger.consoleJson : Logger.consolePretty()])
      if (Option.isNone(endpoint)) return console

      return Otlp.layerJson({
        baseUrl: endpoint.value,
        resource: { serviceName, attributes: { "deployment.environment": env } },
        loggerMergeWithExisting: true,
      }).pipe(Layer.provide(FetchHttpClient.layer), Layer.provideMerge(console))
    }),
  )
