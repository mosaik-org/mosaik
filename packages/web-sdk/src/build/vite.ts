/** `@mosaik/web-sdk/build/vite`: the Vite plugin that builds the app's pages. */

import { type MountedAppOptions, mountedApp } from "@mosaik/portal/build"
import { type StandaloneAppOptions, standaloneApp } from "@mosaik/web-build/vite"

export interface MosaikAppOptions extends MountedAppOptions, StandaloneAppOptions {
  /**
   * A standalone app's own page instead of a bundle for the shell: a normal single-page app
   * from `index.html`, with everything it uses bundled in, served by the backend at `/`.
   */
  readonly standalone?: boolean
}

/**
 * Builds the app's pages: a bundle the Portal's shell mounts at `/<id>`, or with `standalone`
 * the app's own page (Core, no Portal). Either way the app's own styles are compiled by Panda
 * on the page's tokens, without a `postcss.config` of the app's.
 *
 * @example
 * // vite.config.ts
 * export default defineConfig({ plugins: [mosaikApp()] })
 */
export const mosaikApp = (options: MosaikAppOptions = {}): ReturnType<typeof mountedApp> =>
  options.standalone ? standaloneApp(options) : mountedApp(options)
