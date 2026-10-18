import { MutationCache, QueryCache, QueryClient } from "@tanstack/solid-query"
import { errorTag, isPermanentError } from "./errors"

export interface QueryClientOptions {
  /** Called when any query or mutation fails with `Unauthorized` (e.g. the session expired). */
  readonly onUnauthorized?: () => void
}

/** QueryClient with platform defaults: no retries for permanent API errors, session-expiry hook. */
export const createQueryClient = (options: QueryClientOptions = {}): QueryClient => {
  const onError = (error: unknown) => {
    if (errorTag(error) === "Unauthorized") options.onUnauthorized?.()
  }
  return new QueryClient({
    queryCache: new QueryCache({ onError }),
    mutationCache: new MutationCache({ onError }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: (failureCount, error) => !isPermanentError(error) && failureCount < 2,
      },
    },
  })
}
