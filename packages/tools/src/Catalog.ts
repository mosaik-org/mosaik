import { createHash } from "node:crypto"
import type { Principal } from "@mosaik/core"
import { AppRoute, AppTool, AppTools, agentToolName, ROUTES_STREAM_PATH, TOOLS_PATH } from "@mosaik/platform/contract"
import { followEventStream } from "@mosaik/server"
import { Config, Context, Deferred, Duration, Effect, Layer, Queue, Ref, Schema } from "effect"
import { FetchHttpClient, HttpClient, HttpClientResponse } from "effect/http"
import { type InputSchema, inputSchema } from "./Tools"

/** A tool of an installed app, ready for an AI. */
export interface CatalogTool {
  /** As AI clients call it (`agentToolName`). */
  readonly name: string
  readonly app: string
  /** Where the app's backend is reached. */
  readonly upstream: URL
  readonly tool: AppTool
  /** What it takes, as one JSON Schema (see `inputSchema`). */
  readonly input: InputSchema
  /** Changes whenever anything an AI sees of the tool does. */
  readonly fingerprint: string
}

/** How often every app's tools are read again: apps can restart with new ones without the registry changing. */
const REFRESH = Duration.seconds(30)
/** Sooner while some app could not be reached, e.g. one still starting. */
const RETRY = Duration.seconds(5)
/** How long a request waits, right after startup, for the first read of every app's tools. */
const STARTUP_WAIT = Duration.seconds(5)

const decodeTools = Schema.decodeUnknownEffect(Schema.toCodecJson(AppTools))

const fingerprint = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("base64url")

/**
 * Every installed app's tools (what it serves at `TOOLS_PATH`), kept up to date from the
 * platform's registry: read again when apps are installed, upgraded or removed, and every
 * {@link REFRESH} ({@link RETRY} while one cannot be reached). An app that cannot be reached
 * keeps the tools it had.
 */
export class Catalog extends Context.Service<
  Catalog,
  {
    /** The tools someone may call, by name. */
    readonly visibleTo: (principal: Principal) => Effect.Effect<ReadonlyArray<CatalogTool>>
  }
>()("@mosaik/tools/Catalog") {
  static readonly layer = Layer.effect(
    Catalog,
    Effect.gen(function* () {
      const client = (yield* HttpClient.HttpClient).pipe(HttpClient.filterStatusOk)
      const routes = yield* Ref.make<ReadonlyArray<AppRoute>>([])
      const tools = yield* Ref.make<ReadonlyMap<string, ReadonlyArray<CatalogTool>>>(new Map())
      // Wakes the reading loop when the routes change (one pending wake-up is enough).
      const changed = yield* Queue.make<void>({ capacity: 1, strategy: "sliding" })
      // Done once the tools of the platform's first list of apps were read.
      const ready = yield* Deferred.make<void>()

      const readApp = Effect.fn("Catalog.readApp")(function* (route: AppRoute) {
        const upstream = new URL(route.upstream)
        const served = yield* client
          .get(new URL(TOOLS_PATH, upstream))
          .pipe(
            Effect.flatMap(HttpClientResponse.schemaBodyJson(Schema.Json)),
            Effect.flatMap(decodeTools),
            Effect.timeout(Duration.seconds(5)),
          )
        if (served.app !== route.id) return yield* Effect.fail(new Error(`It says it is "${served.app}"`))
        return served.tools.map((tool): CatalogTool => {
          return {
            name: agentToolName(route.id, tool.name),
            app: route.id,
            upstream,
            tool,
            input: inputSchema(tool),
            fingerprint: fingerprint([route.upstream, Schema.encodeSync(AppTool)(tool)]),
          }
        })
      })

      const refresh = Effect.gen(function* () {
        const current = yield* Ref.get(routes)
        const previous = yield* Ref.get(tools)
        const next = new Map<string, ReadonlyArray<CatalogTool>>()
        let unreachable = 0
        yield* Effect.forEach(
          current,
          (route) =>
            readApp(route).pipe(
              Effect.tap((read) => Effect.sync(() => next.set(route.id, read))),
              Effect.catch((error) =>
                Effect.logDebug(`Could not read ${route.id}'s tools`, error).pipe(
                  Effect.andThen(
                    Effect.sync(() => {
                      unreachable++
                      next.set(route.id, previous.get(route.id) ?? [])
                    }),
                  ),
                ),
              ),
            ),
          { concurrency: 8, discard: true },
        )
        yield* Ref.set(tools, next)
        return unreachable === 0
      }).pipe(Effect.withSpan("Catalog.refresh"))

      yield* followEventStream({
        name: "App route",
        url: new URL(ROUTES_STREAM_PATH, yield* Config.URL("PLATFORM_URL")),
        key: yield* Config.Redacted("INTERNAL_KEY"),
        schema: Schema.Array(AppRoute),
        onEvent: (current) => Ref.set(routes, current).pipe(Effect.andThen(Queue.offer(changed, undefined))),
      })
      // One loop reads, so reads never overlap: at once when the routes change, then every
      // REFRESH, or every RETRY while an app cannot be reached (whatever started the read).
      yield* Effect.gen(function* () {
        yield* Queue.take(changed)
        for (;;) {
          const complete = yield* refresh
          yield* Deferred.succeed(ready, undefined)
          yield* Queue.take(changed).pipe(Effect.timeoutOption(complete ? REFRESH : RETRY))
        }
      }).pipe(Effect.forkScoped)

      return Catalog.of({
        visibleTo: (principal) =>
          // Right after startup, a request waits for the first read rather than finding no tools.
          Deferred.await(ready).pipe(
            Effect.timeoutOption(STARTUP_WAIT),
            Effect.andThen(Ref.get(tools)),
            Effect.map((byApp) => {
              // Two apps' tools could map to one name (`a_b` + `c`, `a` + `b_c`): the first wins.
              const visible = new Map<string, CatalogTool>()
              for (const tool of [...byApp.values()].flat()) {
                if (principal.can(tool.tool.permission) && !visible.has(tool.name)) visible.set(tool.name, tool)
              }
              return [...visible.values()]
            }),
          ),
      })
    }),
  ).pipe(Layer.provide(FetchHttpClient.layer))
}
