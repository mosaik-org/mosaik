import { basename } from "node:path"
import { Config, Context, Data, Effect, Layer, Option } from "effect"
import { extractFile } from "./tar"

export class DockerError extends Data.TaggedError("DockerError")<{
  readonly message: string
  readonly status?: number
}> {}

export interface RegistryAuth {
  readonly server: string
  readonly username: string
  readonly password: string
}

export interface ImageInfo {
  readonly id: string
  /** `name@sha256:…`, when the image came from a registry. */
  readonly repoDigests: ReadonlyArray<string>
  readonly labels: Readonly<Record<string, string>>
}

export interface ContainerInfo {
  readonly id: string
  readonly running: boolean
  readonly status: string
  /** Times Docker restarted it (it keeps restarting an app that crashes on startup). */
  readonly restarts: number
  readonly image: string
  /** Host port of the container's port 3000, when published. */
  readonly hostPort: number | null
}

export interface ContainerSpec {
  readonly name: string
  readonly image: string
  readonly env: Readonly<Record<string, string>>
  readonly labels: Readonly<Record<string, string>>
  readonly network: string
  /** Publish port 3000 on 127.0.0.1 (when the Portal reaches apps through the host). */
  readonly publish: boolean
  readonly extraHosts: ReadonlyArray<string>
}

const API = "http://docker/v1.43"

/**
 * A small client for the Docker Engine API over its Unix socket (`DOCKER_SOCKET`):
 * pulling images, reading files from them and running containers.
 */
export class Docker extends Context.Service<
  Docker,
  {
    readonly available: Effect.Effect<boolean>
    pull(name: string, tagOrDigest: string, auth: Option.Option<RegistryAuth>): Effect.Effect<void, DockerError>
    inspectImage(ref: string): Effect.Effect<Option.Option<ImageInfo>, DockerError>
    /** Reads a file from an image without running it. */
    readFile(image: string, path: string): Effect.Effect<Option.Option<string>, DockerError>
    ensureNetwork(name: string): Effect.Effect<void, DockerError>
    run(spec: ContainerSpec): Effect.Effect<ContainerInfo, DockerError>
    inspectContainer(name: string): Effect.Effect<Option.Option<ContainerInfo>, DockerError>
    stop(name: string): Effect.Effect<void, DockerError>
    start(name: string): Effect.Effect<void, DockerError>
    remove(name: string): Effect.Effect<void, DockerError>
    logs(name: string, tail: number): Effect.Effect<string, DockerError>
  }
>()("@mosaik/portal-service/Docker") {
  static readonly layer = Layer.effect(
    Docker,
    Effect.gen(function* () {
      const socket = yield* Config.String("DOCKER_SOCKET").pipe(Config.withDefault("/var/run/docker.sock"))

      const request = (path: string, init: RequestInit & { readonly json?: unknown } = {}) =>
        Effect.tryPromise({
          try: (signal) =>
            fetch(`${API}${path}`, {
              ...init,
              ...(init.json === undefined
                ? {}
                : {
                    body: JSON.stringify(init.json),
                    headers: { "content-type": "application/json", ...init.headers },
                  }),
              signal,
              unix: socket,
            } as RequestInit),
          catch: (cause) => new DockerError({ message: `Docker is not reachable at ${socket}: ${String(cause)}` }),
        })

      const fail = (response: Response, action: string) =>
        Effect.promise(() => response.text()).pipe(
          Effect.flatMap((text) => {
            let message = text
            try {
              message = (JSON.parse(text) as { message?: string }).message ?? text
            } catch {}
            return Effect.fail(new DockerError({ message: `${action}: ${message.trim()}`, status: response.status }))
          }),
        )

      const expect = (path: string, init: RequestInit & { readonly json?: unknown }, action: string) =>
        request(path, init).pipe(
          Effect.flatMap((response) => (response.ok ? Effect.succeed(response) : fail(response, action))),
        )

      const inspectContainer = (name: string) =>
        request(`/containers/${encodeURIComponent(name)}/json`).pipe(
          Effect.flatMap((response) => {
            if (response.status === 404) return Effect.succeed(Option.none<ContainerInfo>())
            if (!response.ok) return fail(response, "Inspect container")
            return Effect.promise(() => response.json() as Promise<DockerContainer>).pipe(
              Effect.map((container) => Option.some(toContainerInfo(container))),
            )
          }),
        )

      const removeContainer = (name: string) =>
        request(`/containers/${encodeURIComponent(name)}?force=true`, { method: "DELETE" }).pipe(
          Effect.flatMap((response) =>
            response.ok || response.status === 404 ? Effect.void : fail(response, "Remove container"),
          ),
        )

      return Docker.of({
        available: request("/_ping").pipe(
          Effect.map((response) => response.ok),
          Effect.catch(() => Effect.succeed(false)),
        ),

        pull: (name, tagOrDigest, auth) =>
          expect(
            `/images/create?fromImage=${encodeURIComponent(name)}&tag=${encodeURIComponent(tagOrDigest)}`,
            {
              method: "POST",
              headers: Option.match(auth, {
                onNone: () => ({}),
                onSome: (credentials) => ({
                  "x-registry-auth": Buffer.from(
                    JSON.stringify({
                      username: credentials.username,
                      password: credentials.password,
                      serveraddress: credentials.server,
                    }),
                  ).toString("base64url"),
                }),
              }),
            },
            `Pull ${name}:${tagOrDigest}`,
          ).pipe(
            // Progress is streamed as JSON lines; failures arrive as an `error` line.
            Effect.flatMap((response) => Effect.promise(() => response.text())),
            Effect.flatMap((text) => {
              const error = text
                .split("\n")
                .flatMap((line) => {
                  try {
                    const event = JSON.parse(line) as { error?: string }
                    return event.error ? [event.error] : []
                  } catch {
                    return []
                  }
                })
                .at(0)
              return error === undefined
                ? Effect.void
                : Effect.fail(new DockerError({ message: `Pull ${name}: ${error}` }))
            }),
            Effect.withSpan("Docker.pull", { attributes: { "docker.image": `${name}:${tagOrDigest}` } }),
          ),

        inspectImage: (ref) =>
          request(`/images/${encodeURIComponent(ref)}/json`).pipe(
            Effect.flatMap((response) => {
              if (response.status === 404) return Effect.succeed(Option.none<ImageInfo>())
              if (!response.ok) return fail(response, "Inspect image")
              return Effect.promise(
                () =>
                  response.json() as Promise<{
                    Id: string
                    RepoDigests?: Array<string>
                    Config?: { Labels?: Record<string, string> }
                  }>,
              ).pipe(
                Effect.map((image) =>
                  Option.some({
                    id: image.Id,
                    repoDigests: image.RepoDigests ?? [],
                    labels: image.Config?.Labels ?? {},
                  }),
                ),
              )
            }),
          ),

        readFile: (image, path) =>
          Effect.acquireUseRelease(
            expect(
              "/containers/create",
              { method: "POST", json: { Image: image, Entrypoint: ["true"], Cmd: [] } },
              "Create container",
            ).pipe(Effect.flatMap((response) => Effect.promise(() => response.json() as Promise<{ Id: string }>))),
            (container) =>
              request(`/containers/${container.Id}/archive?path=${encodeURIComponent(path)}`).pipe(
                Effect.flatMap((response) => {
                  if (response.status === 404) return Effect.succeed(Option.none<string>())
                  if (!response.ok) return fail(response, `Read ${path}`)
                  return Effect.promise(() => response.arrayBuffer()).pipe(
                    Effect.map((buffer) =>
                      Option.map(Option.fromUndefinedOr(extractFile(new Uint8Array(buffer), basename(path))), (bytes) =>
                        new TextDecoder().decode(bytes),
                      ),
                    ),
                  )
                }),
              ),
            (container) => removeContainer(container.Id).pipe(Effect.ignore),
          ),

        ensureNetwork: (name) =>
          request(`/networks/${encodeURIComponent(name)}`).pipe(
            Effect.flatMap((response) =>
              response.ok
                ? Effect.void
                : expect(
                    "/networks/create",
                    { method: "POST", json: { Name: name, Driver: "bridge" } },
                    "Create network",
                  ).pipe(Effect.asVoid),
            ),
          ),

        run: (spec) =>
          Effect.gen(function* () {
            yield* removeContainer(spec.name)
            yield* expect(
              `/containers/create?name=${encodeURIComponent(spec.name)}`,
              {
                method: "POST",
                json: {
                  Image: spec.image,
                  Env: Object.entries(spec.env).map(([name, value]) => `${name}=${value}`),
                  Labels: spec.labels,
                  ExposedPorts: { "3000/tcp": {} },
                  HostConfig: {
                    NetworkMode: spec.network,
                    RestartPolicy: { Name: "unless-stopped" },
                    ExtraHosts: [...spec.extraHosts],
                    ...(spec.publish ? { PortBindings: { "3000/tcp": [{ HostIp: "127.0.0.1", HostPort: "" }] } } : {}),
                  },
                },
              },
              "Create container",
            )
            yield* expect(`/containers/${encodeURIComponent(spec.name)}/start`, { method: "POST" }, "Start container")
            const info = yield* inspectContainer(spec.name)
            return yield* Option.match(info, {
              onNone: () => Effect.fail(new DockerError({ message: "The container disappeared after starting" })),
              onSome: Effect.succeed,
            })
          }).pipe(Effect.withSpan("Docker.run", { attributes: { "docker.container": spec.name } })),

        inspectContainer,

        stop: (name) =>
          request(`/containers/${encodeURIComponent(name)}/stop?t=10`, { method: "POST" }).pipe(
            Effect.flatMap((response) =>
              response.ok || response.status === 304 || response.status === 404
                ? Effect.void
                : fail(response, "Stop container"),
            ),
          ),

        start: (name) =>
          request(`/containers/${encodeURIComponent(name)}/start`, { method: "POST" }).pipe(
            Effect.flatMap((response) =>
              response.ok || response.status === 304 ? Effect.void : fail(response, "Start container"),
            ),
          ),

        remove: removeContainer,

        logs: (name, tail) =>
          expect(
            `/containers/${encodeURIComponent(name)}/logs?stdout=true&stderr=true&timestamps=true&tail=${tail}`,
            {},
            "Read logs",
          ).pipe(
            Effect.flatMap((response) => Effect.promise(() => response.arrayBuffer())),
            Effect.map((buffer) => demultiplex(new Uint8Array(buffer))),
          ),
      })
    }),
  )
}

interface DockerContainer {
  readonly Id: string
  readonly Image: string
  readonly State: { readonly Running: boolean; readonly Restarting?: boolean; readonly Status: string }
  readonly RestartCount?: number
  readonly NetworkSettings?: { readonly Ports?: Record<string, ReadonlyArray<{ HostPort: string }> | null> }
}

const toContainerInfo = (container: DockerContainer): ContainerInfo => {
  const binding = container.NetworkSettings?.Ports?.["3000/tcp"]?.[0]
  return {
    id: container.Id,
    running: container.State.Running && container.State.Restarting !== true,
    status: container.State.Status,
    restarts: container.RestartCount ?? 0,
    image: container.Image,
    hostPort: binding === undefined ? null : Number(binding.HostPort),
  }
}

/** Container logs without a TTY come as frames: 8-byte header (stream, size) + payload. */
export const demultiplex = (bytes: Uint8Array): string => {
  const decoder = new TextDecoder()
  let offset = 0
  let text = ""
  while (offset + 8 <= bytes.length) {
    const size = new DataView(bytes.buffer, bytes.byteOffset + offset + 4, 4).getUint32(0)
    text += decoder.decode(bytes.subarray(offset + 8, offset + 8 + size))
    offset += 8 + size
  }
  return offset === 0 && bytes.length > 0 ? decoder.decode(bytes) : text
}
