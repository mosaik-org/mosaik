import { AppManifest } from "@mosaik/platform/contract"
import { Context, Data, Duration, Effect, Layer, Option, Schedule, Schema } from "effect"
import { Docker, type DockerError } from "./docker/Docker"
import { formatImageRef, parseImageRef } from "./docker/imageRef"
import { PortalConfig } from "./PortalConfig"

export class DeployError extends Data.TaggedError("DeployError")<{ readonly message: string }> {}

/** Where the manifest is in an image built from the app template (or the `dev.mosaik.manifest` label). */
const MANIFEST_FILE = "/app/mosaik-app.json"
const MANIFEST_LABEL = "dev.mosaik.manifest"
const HEALTH_TIMEOUT = Duration.seconds(60)
/** Deploy failures that waiting longer will not fix. */
const STOPPED = "The container "

const decodeManifest = Schema.decodeUnknownEffect(Schema.fromJsonString(AppManifest))

export interface PulledImage {
  /** What containers run: the immutable `name@sha256:…` (or the image id for local images). */
  readonly digest: string
  readonly manifest: Option.Option<AppManifest>
}

export const containerName = (appId: string) => `mosaik-app-${appId}`

const toDeployError = (error: DockerError | DeployError) =>
  error._tag === "DeployError" ? error : new DeployError({ message: error.message })

/**
 * Runs image apps as Docker containers on this host: pulls images (pinned by digest; an
 * image that cannot be pulled but exists on this host is used as it is),
 * reads their manifest, starts containers on the apps network and waits until they are healthy.
 */
export class Deployer extends Context.Service<
  Deployer,
  {
    readonly available: Effect.Effect<boolean>
    pull(
      image: string,
      auth: (registry: string) => Effect.Effect<Option.Option<{ username: string; password: string }>>,
    ): Effect.Effect<PulledImage, DeployError>
    /** Starts the app (replacing a running container) and resolves with its address once healthy. */
    start(appId: string, digest: string, env: Readonly<Record<string, string>>): Effect.Effect<string, DeployError>
    /** The address of the app's running container, if any. */
    address(appId: string): Effect.Effect<Option.Option<string>, DeployError>
    stop(appId: string): Effect.Effect<void, DeployError>
    remove(appId: string): Effect.Effect<void, DeployError>
    logs(appId: string, tail: number): Effect.Effect<string, DeployError>
  }
>()("@mosaik/portal-service/Deployer") {
  static readonly layer = Layer.effect(
    Deployer,
    Effect.gen(function* () {
      const docker = yield* Docker
      const { deploy } = yield* PortalConfig

      const addressOf = (appId: string, hostPort: number | null) =>
        deploy.addressing === "network"
          ? `http://${containerName(appId)}:3000`
          : hostPort === null
            ? undefined
            : `http://127.0.0.1:${hostPort}`

      const healthy = (url: string) =>
        Effect.tryPromise({
          try: (signal) =>
            fetch(new URL("/health", url), { signal: AbortSignal.any([signal, AbortSignal.timeout(2000)]) }),
          catch: () => new DeployError({ message: "Not answering yet" }),
        }).pipe(
          Effect.flatMap((response) =>
            response.ok
              ? Effect.void
              : Effect.fail(new DeployError({ message: `Health check: HTTP ${response.status}` })),
          ),
        )

      const waitHealthy = (appId: string, url: string) =>
        Effect.gen(function* () {
          const container = yield* docker.inspectContainer(containerName(appId)).pipe(Effect.mapError(toDeployError))
          // Crashing on startup: Docker restarts it, so it never stays exited.
          if (Option.isSome(container) && (!container.value.running || container.value.restarts > 0)) {
            const logs = yield* docker.logs(containerName(appId), 20).pipe(Effect.orElseSucceed(() => ""))
            return yield* Effect.fail(
              new DeployError({
                message: `${STOPPED}${container.value.restarts > 0 ? "keeps crashing" : `exited (${container.value.status})`}. Last logs:\n${logs.trim()}`,
              }),
            )
          }
          yield* healthy(url)
        }).pipe(
          Effect.retry({
            while: (error) => !error.message.startsWith(STOPPED),
            schedule: Schedule.spaced("1 second"),
          }),
          Effect.timeoutOrElse({
            duration: HEALTH_TIMEOUT,
            orElse: () =>
              Effect.fail(
                new DeployError({
                  message: `The app did not become healthy within ${Duration.format(HEALTH_TIMEOUT)}`,
                }),
              ),
          }),
        )

      return Deployer.of({
        available: docker.available,

        pull: Effect.fn("Deployer.pull")(function* (image, auth) {
          const ref = yield* Effect.try({
            try: () => parseImageRef(image),
            catch: (error) => new DeployError({ message: String((error as Error).message) }),
          })
          const credentials = ref.registry === null ? Option.none() : yield* auth(ref.registry)
          const local = docker.inspectImage(formatImageRef(ref)).pipe(Effect.mapError(toDeployError))
          yield* docker
            .pull(
              ref.name,
              ref.digest ?? ref.tag ?? "latest",
              Option.map(credentials, (c) => ({ ...c, server: ref.registry ?? "" })),
            )
            .pipe(
              Effect.mapError(toDeployError),
              // An image built on this host (`docker build -t demo .`) is in no registry: like `docker run`, use it.
              Effect.catch((error) =>
                Effect.flatMap(local, (found) =>
                  Option.isNone(found)
                    ? Effect.fail(error)
                    : Effect.logWarning(`Could not pull ${image}, using the image on this host`, error.message),
                ),
              ),
            )
          const info = yield* local
          if (Option.isNone(info)) return yield* new DeployError({ message: `Image ${image} not found after pulling` })
          const digest =
            info.value.repoDigests.find((candidate) => candidate.startsWith(`${ref.name}@`)) ?? info.value.id

          const label = info.value.labels[MANIFEST_LABEL]
          const raw =
            label !== undefined
              ? Option.some(label)
              : yield* docker.readFile(info.value.id, MANIFEST_FILE).pipe(Effect.mapError(toDeployError))
          const manifest = Option.isNone(raw)
            ? Option.none<AppManifest>()
            : Option.some(
                yield* decodeManifest(raw.value).pipe(
                  Effect.mapError(
                    (issue) => new DeployError({ message: `Invalid ${MANIFEST_FILE}: ${issue.message}` }),
                  ),
                ),
              )
          return { digest, manifest }
        }),

        start: Effect.fn("Deployer.start")(function* (appId, digest, env) {
          yield* docker.ensureNetwork(deploy.network).pipe(Effect.mapError(toDeployError))
          const container = yield* docker
            .run({
              name: containerName(appId),
              image: digest,
              env,
              labels: { "dev.mosaik.app": appId },
              network: deploy.network,
              publish: deploy.addressing === "host",
              // Lets apps reach the platform on the host (`APP_PLATFORM_URL=http://host.docker.internal:…`).
              extraHosts: ["host.docker.internal:host-gateway"],
            })
            .pipe(Effect.mapError(toDeployError))
          const url = addressOf(appId, container.hostPort)
          if (url === undefined) return yield* new DeployError({ message: "The container has no published port" })
          yield* waitHealthy(appId, url)
          return url
        }),

        address: (appId) =>
          docker
            .inspectContainer(containerName(appId))
            .pipe(
              Effect.map(
                Option.flatMap((container) =>
                  container.running ? Option.fromUndefinedOr(addressOf(appId, container.hostPort)) : Option.none(),
                ),
              ),
              Effect.mapError(toDeployError),
            ),

        stop: (appId) => docker.stop(containerName(appId)).pipe(Effect.mapError(toDeployError)),
        remove: (appId) => docker.remove(containerName(appId)).pipe(Effect.mapError(toDeployError)),
        logs: (appId, tail) => docker.logs(containerName(appId), tail).pipe(Effect.mapError(toDeployError)),
      })
    }),
  )
}
