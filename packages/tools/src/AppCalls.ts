import { Clock, Config, Context, Duration, Effect, Layer, Option, Result } from "effect"
import { FetchHttpClient, HttpBody, HttpClient, HttpClientRequest } from "effect/http"
import type { CatalogTool } from "./Catalog"
import { failure, type ToolOutcome, toOutcome, toRequest } from "./Tools"

/** Who a call is made for. */
export interface Caller {
  /** What the rate limit counts calls by: an AI client's connection, a person. */
  readonly key: string
  /**
   * A token to call the app as the person, with their current grants; `None` when they may no
   * longer act (a revoked connection, a deleted user).
   */
  readonly token: (app: string) => Effect.Effect<Option.Option<string>>
}

/** How long an app may take to answer a call. */
const CALL_TIMEOUT = Duration.seconds(30)

/**
 * Tool calls, made as a person: with a token for the app, straight to the app's backend (as the
 * gateway would forward them), so the app checks permissions, validates and audits as for any
 * request. Each caller may make `TOOL_CALLS_PER_MINUTE` calls a minute.
 */
export class AppCalls extends Context.Service<
  AppCalls,
  { readonly call: (caller: Caller, tool: CatalogTool, args: unknown) => Effect.Effect<ToolOutcome> }
>()("@mosaik/tools/AppCalls") {
  static readonly layer = Layer.effect(
    AppCalls,
    Effect.gen(function* () {
      const http = yield* HttpClient.HttpClient
      const perMinute = yield* Config.Int("TOOL_CALLS_PER_MINUTE").pipe(Config.withDefault(120))
      // Calls in the current minute, per caller. Fixed windows: simple, and enough against runaway loops.
      const windows = new Map<string, { readonly minute: number; count: number }>()

      const allow = Effect.fn(function* (key: string) {
        const minute = Math.floor((yield* Clock.currentTimeMillis) / 60_000)
        const window = windows.get(key)
        if (window === undefined || window.minute !== minute) {
          // Old windows of every caller go with the minute.
          for (const [other, old] of windows) if (old.minute !== minute) windows.delete(other)
          windows.set(key, { minute, count: 1 })
          return true
        }
        window.count++
        return window.count <= perMinute
      })

      return AppCalls.of({
        call: Effect.fn("AppCalls.call")(function* (caller, tool, args) {
          yield* Effect.annotateCurrentSpan({ "mosaik.app": tool.app, "mosaik.tool": tool.name })
          if (!(yield* allow(caller.key))) {
            return failure(`Too many calls: at most ${perMinute} a minute. Wait a minute before trying again.`)
          }
          const request = toRequest(tool.tool, args)
          if (Result.isFailure(request)) return failure(request.failure)
          const token = yield* caller.token(tool.app)
          if (Option.isNone(token))
            return failure("Access to Mosaik was revoked or has expired: sign in to Mosaik again.")
          const { method, url, body } = request.success
          return yield* http
            .execute(
              HttpClientRequest.make(method)(new URL(url, tool.upstream)).pipe(
                HttpClientRequest.bearerToken(token.value),
                HttpClientRequest.acceptJson,
                body === undefined
                  ? (request) => request
                  : HttpClientRequest.setBody(HttpBody.text(body, "application/json")),
              ),
            )
            .pipe(
              Effect.flatMap((response) => Effect.map(response.text, (text) => toOutcome(response.status, text))),
              Effect.timeout(CALL_TIMEOUT),
              Effect.catch((error) =>
                Effect.as(
                  Effect.logWarning(`Calling ${tool.name} failed`, error),
                  failure(`${tool.app} did not answer. Try again later.`),
                ),
              ),
            )
        }),
      })
    }),
  ).pipe(Layer.provide(FetchHttpClient.layer))
}
