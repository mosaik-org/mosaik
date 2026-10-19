import { Cause, type Effect, Exit, ManagedRuntime } from "effect"
import { FetchHttpClient, type HttpClient } from "effect/http"
import { type HttpApi, HttpApiClient, type HttpApiGroup } from "effect/http-api"

const runtime = ManagedRuntime.make(FetchHttpClient.layer)

/**
 * Promise-based access to a typed `HttpApi` client, for TanStack Query.
 * Failures reject with the API's typed error (e.g. `Forbidden`, `NotFound`),
 * so `query.error._tag` can be inspected; see {@link errorTag}.
 */
export type ApiClient<Groups extends HttpApiGroup.Constraint> = <A, E>(
  request: (client: HttpApiClient.Client<Groups>) => Effect.Effect<A, E>,
) => Promise<A>

/** Browser APIs authenticate with the session cookie, so no client middleware may be required. */
export type BrowserApi<Id extends string, Groups extends HttpApiGroup.Constraint> = HttpApi.HttpApi<Id, Groups> &
  ([HttpApiGroup.MiddlewareClient<Groups>] extends [never] ? unknown : "This API requires client middleware")

/**
 * Creates a client for an app API contract. Requests go to the current origin,
 * where the gateway attaches the session token.
 *
 * @example
 * const salesApi = makeApiClient(SalesApi)
 * useQuery(() => ({ queryKey: ["sales", "summary"], queryFn: () => salesApi((c) => c.stats.summary({ query: {} })) }))
 */
export const makeApiClient = <Id extends string, Groups extends HttpApiGroup.Constraint>(
  api: BrowserApi<Id, Groups>,
): ApiClient<Groups> => {
  let client: Promise<HttpApiClient.Client<Groups>> | undefined
  const getClient = () => {
    // `BrowserApi` guarantees there is no client middleware left to provide.
    client ??= runtime.runPromise(
      HttpApiClient.make(api, { baseUrl: globalThis.location?.origin }) as Effect.Effect<
        HttpApiClient.Client<Groups>,
        never,
        HttpClient.HttpClient
      >,
    )
    return client
  }
  return async (request) => {
    const exit = await runtime.runPromiseExit(request(await getClient()))
    if (Exit.isSuccess(exit)) return exit.value
    throw Cause.squash(exit.cause)
  }
}
