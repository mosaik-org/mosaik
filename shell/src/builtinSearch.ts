import type { SearchProvider, SearchSource } from "@mosaik/frame"

/**
 * Search providers of built-in apps (`apps/<id>/web/search.ts`), each loaded on first use of the
 * palette. The glob stays out of `.tsx` files: Vite's dependency scanner would fail on their JSX.
 */
export const builtinSearchSources: ReadonlyArray<SearchSource> = Object.entries(
  import.meta.glob<{ default: SearchProvider }>("../../apps/*/web/search.ts"),
).map(([path, load]) => ({
  app: /apps\/([^/]+)\/web\/search\.ts$/.exec(path)?.[1] ?? path,
  load: () => load().then((module) => module.default),
}))
