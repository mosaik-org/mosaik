import { type Fresh, fresh } from "@mosaik/core"
import { Cache, DateTime, Duration, Effect, Exit, Schedule, type Schema } from "effect"
import { HttpClient, HttpClientRequest, HttpClientResponse } from "effect/http"
import { RateLimiter } from "effect/persistence"
import { type Auth, none } from "./Auth"
import { type ConnectorError, toConnectorError } from "./ConnectorError"

export interface ConnectorOptions {
  /** Used in errors, traces, rate-limit keys and freshness sources, e.g. "Jira". */
  readonly name: string
  readonly baseUrl: URL
  readonly auth?: Auth
  /** Per request, including retries of that request. Defaults to 15 seconds. */
  readonly timeout?: Duration.Input
  /** Retries of transient failures (network errors, 5xx). Defaults to 2. */
  readonly retries?: number
  /** Client-side limit; 429 responses are retried and `Retry-After` style headers respected. */
  readonly rateLimit?: { readonly limit: number; readonly window: Duration.Input }
  readonly headers?: Record<string, string>
}

export type QueryValue = string | number | boolean | undefined

export interface RequestOptions {
  readonly query?: Record<string, QueryValue | ReadonlyArray<string>>
  readonly headers?: Record<string, string>
}

export interface CacheOptions<K> {
  readonly ttl: Duration.Input
  readonly capacity?: number
  /** Cache key; defaults to `JSON.stringify(key)`. */
  readonly key?: (key: K) => string
}

/**
 * Caches a lookup for `ttl`. Results are wrapped in `Fresh` with the time they were
 * fetched and `source`, so apps can show how old the data is. Concurrent
 * lookups of the same key share one request; failures are not cached.
 */
export const cache = <K, A, E, R>(
  lookup: (key: K) => Effect.Effect<A, E, R>,
  options: CacheOptions<K> & { readonly source: string },
): Effect.Effect<(key: K) => Effect.Effect<Fresh<A>, E>, never, R> =>
  Effect.gen(function* () {
    const keyOf = options.key ?? ((key: K) => JSON.stringify(key))
    const context = yield* Effect.context<R>()
    // Entries are keyed by string so structurally equal keys share an entry.
    const keys = new Map<string, K>()
    const entries = yield* Cache.makeWith(
      (id: string) =>
        Effect.gen(function* () {
          const value = yield* lookup(keys.get(id) as K)
          return fresh(value, yield* DateTime.now, options.source)
        }).pipe(Effect.provideContext(context)),
      {
        capacity: options.capacity ?? 256,
        timeToLive: (exit) => (Exit.isSuccess(exit) ? options.ttl : Duration.zero),
      },
    )
    return (key: K) => {
      const id = keyOf(key)
      keys.set(id, key)
      return Cache.get(entries, id)
    }
  })

/** A configured client for one external system. Build one with {@link make}. */
export interface Connector {
  readonly name: string
  readonly baseUrl: URL
  /** The fully configured client (base URL, auth, retries, rate limit) for custom requests. */
  readonly client: HttpClient.HttpClient.With<ConnectorError>
  /** GET a JSON resource and decode it with `schema`. */
  get<S extends Schema.Top>(
    path: string,
    schema: S,
    options?: RequestOptions,
  ): Effect.Effect<S["Type"], ConnectorError, S["DecodingServices"]>
  /** POST a JSON body and decode the JSON response with `schema`. */
  post<S extends Schema.Top>(
    path: string,
    schema: S,
    options?: RequestOptions & { readonly body?: unknown },
  ): Effect.Effect<S["Type"], ConnectorError, S["DecodingServices"]>
  /** {@link cache} with this connector's name as the source. */
  cached<K, A, E, R>(
    lookup: (key: K) => Effect.Effect<A, E, R>,
    options: CacheOptions<K>,
  ): Effect.Effect<(key: K) => Effect.Effect<Fresh<A>, E>, never, R>
  /** Calls a cheap endpoint to check reachability and credentials. */
  health(path: string): Effect.Effect<ConnectorHealth>
}

export interface ConnectorHealth {
  readonly connector: string
  readonly ok: boolean
  readonly latencyMs: number
  readonly error?: ConnectorError["reason"]
}

const toUrlParams = (query: RequestOptions["query"] = {}) =>
  Object.entries(query).flatMap(
    ([key, value]): Array<[string, string]> =>
      value === undefined ? [] : Array.isArray(value) ? value.map((item) => [key, item]) : [[key, String(value)]],
  )

/**
 * Builds a connector: base URL, authentication, timeouts, retries with backoff,
 * client-side rate limiting, typed errors, schema decoding and tracing (every
 * request is a span named after the connector).
 */
export const make = Effect.fn("Connector.make")(function* (options: ConnectorOptions) {
  const authenticate = yield* (options.auth ?? none).make(options.name)
  const timeout = options.timeout ?? Duration.seconds(15)

  const base = (yield* HttpClient.HttpClient).pipe(
    HttpClient.mapRequest((request) =>
      request.pipe(
        HttpClientRequest.prependUrl(options.baseUrl.toString().replace(/\/$/, "")),
        HttpClientRequest.acceptJson,
        HttpClientRequest.setHeaders(options.headers ?? {}),
      ),
    ),
    HttpClient.mapRequestEffect(authenticate),
    HttpClient.filterStatusOk,
    HttpClient.retryTransient({
      times: options.retries ?? 2,
      schedule: Schedule.exponential("250 millis").pipe(Schedule.jittered),
    }),
  )

  /** Every failure surfaces as a `ConnectorError`. */
  const typed = <E>(client: HttpClient.HttpClient.With<E>): HttpClient.HttpClient.With<ConnectorError> =>
    client.pipe(HttpClient.transformResponse(Effect.mapError(toConnectorError(options.name))))

  const client = options.rateLimit
    ? typed(
        base.pipe(
          HttpClient.withRateLimiter({
            limiter: yield* RateLimiter.make.pipe(Effect.provide(RateLimiter.layerStoreMemory)),
            key: `connector:${options.name}`,
            limit: options.rateLimit.limit,
            window: options.rateLimit.window,
            times: 3,
          }),
        ),
      )
    : typed(base)

  const run = <S extends Schema.Top>(request: HttpClientRequest.HttpClientRequest, schema: S) =>
    client.execute(request).pipe(
      Effect.flatMap(HttpClientResponse.schemaBodyJson(schema)),
      Effect.timeout(timeout),
      Effect.mapError(toConnectorError(options.name)),
      Effect.withSpan(`${options.name} ${request.method} ${request.url}`, {
        attributes: { "connector.name": options.name },
      }),
    )

  const request = (method: "GET" | "POST", path: string, requestOptions: RequestOptions = {}) =>
    HttpClientRequest.make(method)(path).pipe(
      HttpClientRequest.setUrlParams(toUrlParams(requestOptions.query)),
      HttpClientRequest.setHeaders(requestOptions.headers ?? {}),
    )

  const connector: Connector = {
    name: options.name,
    baseUrl: options.baseUrl,
    client,

    get: (path, schema, requestOptions) => run(request("GET", path, requestOptions), schema),

    post: (path, schema, requestOptions) =>
      run(
        request("POST", path, requestOptions).pipe(HttpClientRequest.bodyJsonUnsafe(requestOptions?.body ?? {})),
        schema,
      ),

    cached: (lookup, cacheOptions) => cache(lookup, { ...cacheOptions, source: options.name }),

    health: (path) =>
      client.execute(request("GET", path)).pipe(
        Effect.timeout(Duration.seconds(5)),
        Effect.timed,
        Effect.map(
          ([duration]): ConnectorHealth => ({
            connector: options.name,
            ok: true,
            latencyMs: Duration.toMillis(duration),
          }),
        ),
        Effect.catch((error) =>
          Effect.succeed<ConnectorHealth>({
            connector: options.name,
            ok: false,
            latencyMs: 0,
            error: toConnectorError(options.name)(error).reason,
          }),
        ),
      ),
  }
  return connector
})
