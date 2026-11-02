import { createHash } from "node:crypto"
import type { Principal } from "@mosaik/core"
import { AppRoute, AppTool, AppTools, agentToolName, ROUTES_STREAM_PATH, TOOLS_PATH } from "@mosaik/platform/contract"
import { followEventStream } from "@mosaik/server"
import { Config, Context, Duration, Effect, Layer, Ref, Schema, Semaphore } from "effect"
import type { McpSchema } from "effect/ai"
import { FetchHttpClient, HttpClient, HttpClientResponse } from "effect/http"
import { toMcpTool } from "./AgentTools"

/** A tool of an installed app, ready for AI clients. */
export interface CatalogTool {
  /** As AI clients call it (`agentToolName`). */
  readonly name: string
  readonly app: string
  /** Where the app's backend is reached. */
  readonly upstream: URL
  readonly tool: AppTool
  readonly definition: McpSchema.Tool
  /** Changes whenever anything AI clients see of the tool does. */
  readonly fingerprint: string
}

/** How often every app's tools are read again: apps can restart with new ones without the registry changing. */
const REFRESH = Duration.seconds(30)
/** Sooner while some app could not be reached, e.g. one still starting. */
const RETRY = Duration.seconds(5)

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
>()("@mosaik/mcp/Catalog") {
  static readonly layer = Layer.effect(
    Catalog,
    Effect.gen(function* () {
      const client = (yield* HttpClient.HttpClient).pipe(HttpClient.filterStatusOk)
      const routes = yield* Ref.make<ReadonlyArray<AppRoute>>([])
      const tools = yield* Ref.make<ReadonlyMap<string, ReadonlyArray<CatalogTool>>>(new Map())
      // One refresh at a time: a slower one must not overwrite a newer one's result.
      const refreshing = yield* Semaphore.make(1)

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
          const name = agentToolName(route.id, tool.name)
          const definition = toMcpTool(name, tool)
          return {
            name,
            app: route.id,
            upstream,
            tool,
            definition,
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
      }).pipe(refreshing.withPermit, Effect.withSpan("Catalog.refresh"))

      yield* followEventStream({
        name: "App route",
        url: new URL(ROUTES_STREAM_PATH, yield* Config.URL("PLATFORM_URL")),
        key: yield* Config.Redacted("INTERNAL_KEY"),
        schema: Schema.Array(AppRoute),
        onEvent: (current) => Ref.set(routes, current).pipe(Effect.andThen(refresh)),
      })
      yield* refresh.pipe(
        Effect.flatMap((complete) => Effect.sleep(complete ? REFRESH : RETRY)),
        Effect.forever,
        Effect.forkScoped,
      )

      return Catalog.of({
        visibleTo: (principal) =>
          Ref.get(tools).pipe(
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
