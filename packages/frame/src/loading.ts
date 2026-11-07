/** Rejects with `message` if `promise` has not settled after `ms` milliseconds. */
export const withTimeout = <A>(promise: Promise<A>, ms: number, message: string): Promise<A> =>
  new Promise<A>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms)
    promise.then(resolve, reject).finally(() => clearTimeout(timer))
  })

/** Messages browsers (Chromium, Firefox, Safari) and Vite use when a lazily loaded module or its CSS cannot be fetched. */
const CHUNK_LOAD_ERROR =
  /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS/i

/**
 * Whether `error` means a lazily loaded file could not be fetched. After a deploy this
 * usually means the page still runs the previous version, whose files are gone.
 */
export const isChunkLoadError = (error: unknown): boolean =>
  error instanceof Error && CHUNK_LOAD_ERROR.test(error.message)
