import { Config, Context, Effect, Layer, Option, type Redacted } from "effect"

/** How apps in containers are run and reached. */
export interface DeployConfig {
  /** Docker network the containers join (`DOCKER_NETWORK`, default `mosaik-apps`). */
  readonly network: string
  /**
   * How the Portal and the gateway reach containers (`APP_ADDRESSING`):
   * - `network`: by container name; the Portal runs in a container on the same network (compose)
   * - `host`: through a port published on 127.0.0.1; the Portal runs on the host (`bun dev`, systemd)
   */
  readonly addressing: "network" | "host"
  /** The platform API as seen from a container (`APP_PLATFORM_URL`). */
  readonly platformUrl: string
  /** Passed to containers as `OTEL_EXPORTER_OTLP_ENDPOINT` (`APP_OTEL_EXPORTER_OTLP_ENDPOINT`). */
  readonly otelEndpoint: Option.Option<string>
}

const nonEmpty = (name: string) =>
  Config.String(name).pipe(Config.option, Config.map(Option.filter((value) => value.length > 0)))

/** Portal service configuration, read from the environment. */
export class PortalConfig extends Context.Service<
  PortalConfig,
  {
    /** The key that encrypts stored secrets is derived from it. */
    readonly internalKey: Redacted.Redacted<string>
    readonly deploy: DeployConfig
  }
>()("@mosaik/portal-service/PortalConfig") {
  static readonly layer = Layer.effect(
    PortalConfig,
    Effect.gen(function* () {
      return PortalConfig.of({
        internalKey: yield* Config.Redacted("INTERNAL_KEY"),
        deploy: {
          network: yield* Config.String("DOCKER_NETWORK").pipe(Config.withDefault("mosaik-apps")),
          addressing: yield* Config.Literals(["network", "host"], "APP_ADDRESSING").pipe(Config.withDefault("network")),
          platformUrl: yield* Config.String("APP_PLATFORM_URL").pipe(Config.withDefault("http://platform:3000")),
          otelEndpoint: yield* nonEmpty("APP_OTEL_EXPORTER_OTLP_ENDPOINT"),
        },
      })
    }),
  )
}
