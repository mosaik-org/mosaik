import type { SearchSource } from "./types"

/** Up to this many apps with search, every search asks all of them. */
export const SEARCH_ALL_LIMIT = 8

export interface SearchScope {
  /** Only this app's data (the user pressed Tab on one of its commands). */
  readonly app: string | undefined
  /** The user asked to search every app. */
  readonly everything: boolean
  readonly affinity: (app: string) => number
}

/**
 * Which providers a search asks, so hundreds of apps do not mean hundreds of requests per
 * keystroke: the scoped app's, or all of them when there are few or the user asked, else
 * those of the apps the user uses. `skipped` is how many were left out.
 */
export const sourcesToSearch = (
  sources: ReadonlyArray<SearchSource>,
  scope: SearchScope,
): { readonly searched: ReadonlyArray<SearchSource>; readonly skipped: number } => {
  if (scope.app !== undefined) return { searched: sources.filter((source) => source.app === scope.app), skipped: 0 }
  if (scope.everything || sources.length <= SEARCH_ALL_LIMIT) return { searched: sources, skipped: 0 }
  const searched = sources.filter((source) => scope.affinity(source.app) > 0)
  return { searched, skipped: sources.length - searched.length }
}
