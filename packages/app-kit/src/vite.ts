import type { Plugin, PluginOption } from "vite"
import solid from "vite-plugin-solid"
import { appPostcssPlugins } from "./styles"

export interface StandaloneAppOptions {
  /** Defaults to `dist/web`; the backend serves it at `/`. */
  readonly outDir?: string
}

/**
 * The app's own styles, compiled by Panda: its classes only, on the page's tokens (see
 * `appLayerOnly`). Set by the build plugins rather than in a `postcss.config` of the app's, so
 * every app gets it, mounted or standalone.
 */
export const appStyles = (root: string) => ({ postcss: { plugins: [...appPostcssPlugins(root)] } })

/**
 * Builds a standalone app's own page: a normal single-page app from `index.html`, with everything
 * it uses bundled in, served by the backend at `/`. A bundle mounted in the Portal's shell is the
 * Portal's build instead (`@mosaik/portal/build`); apps choose with `mosaikApp()` from the SDK.
 */
export const standaloneApp = (options: StandaloneAppOptions = {}): PluginOption[] => {
  const plugin: Plugin = {
    name: "mosaik:standalone",
    config: (config) => ({
      base: "/",
      css: appStyles(config.root ?? process.cwd()),
      build: {
        outDir: options.outDir ?? "dist/web",
        emptyOutDir: true,
        target: "es2023",
        sourcemap: true,
      },
    }),
  }
  return [solid(), plugin]
}
