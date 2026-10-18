import type { SearchSource } from "@mosaik/web-kit"

/**
 * Search providers of installed apps (their `web/search.ts`), filled by `registerInstalledApps`.
 * The palette loads one only for principals who may open the app.
 */
export const installedSearchSources: Array<SearchSource> = []
