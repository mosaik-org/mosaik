import { Duration } from "effect"

export type FreshnessState = "fresh" | "aging" | "stale" | "unknown"

/** Fresh until half of `staleAfter`, then aging, then stale. */
export const freshnessState = (age: number | undefined, staleAfter: Duration.Input): FreshnessState => {
  if (age === undefined) return "unknown"
  const limit = Duration.toMillis(staleAfter)
  return age >= limit ? "stale" : age >= limit / 2 ? "aging" : "fresh"
}
