import type { JSX } from "solid-js"

declare module "@tanstack/solid-router" {
  interface StaticDataRouteOption {
    /** Title in the command palette. Routes without a title are not listed. */
    title?: string
    /** Extra words the command palette matches (e.g. "revenue", "kpi"). */
    keywords?: ReadonlyArray<string>
    /** Permission needed to see the page in the palette, on top of the app's access permission. */
    permission?: string
  }
}

/** The app a command belongs to. */
export interface CommandApp {
  readonly id: string
  readonly name: string
}

/** An entry in the command palette. */
export interface Command {
  readonly id: string
  readonly title: string
  /** Heading the command is listed under, e.g. "Pages", "Actions" or an app name. */
  readonly group: string
  readonly subtitle?: string
  readonly keywords?: ReadonlyArray<string>
  readonly icon?: JSX.Element
  /** Shown on the right, e.g. the app a page belongs to. */
  readonly hint?: string
  /** Ranks the command by how much the user uses the app; Tab on it searches only that app. */
  readonly app?: CommandApp
  readonly perform: () => unknown
}

export interface SearchResult {
  readonly id: string
  readonly title: string
  readonly subtitle?: string
  readonly icon?: JSX.Element
  /** Where selecting the result navigates (path and search, e.g. `/sales/orders?search=SO-1`). */
  readonly to: string
}

/**
 * Searches an app's own data from the command palette (e.g. "SO-10023").
 * Export one as the default export of `apps/<id>/web/search.ts`; the shell
 * discovers it and loads it the first time the palette is used.
 */
export interface SearchProvider {
  readonly id: string
  /** Heading for the results, e.g. "Orders". */
  readonly group: string
  /** Only principals with this permission see the provider's results. */
  readonly permission?: string
  /** Defaults to 2. */
  readonly minQueryLength?: number
  search(query: string): Promise<ReadonlyArray<SearchResult>>
}

export const defineSearchProvider = (provider: SearchProvider): SearchProvider => provider

export type SearchProviderLoader = () => Promise<SearchProvider>

/** A search provider, and the app whose data it searches. */
export interface SearchSource {
  readonly app: string
  readonly load: SearchProviderLoader
}
