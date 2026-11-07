import { existsSync } from "node:fs"
import { resolve } from "node:path"
import panda from "@pandacss/dev/postcss"
import type { AcceptedPlugin, PluginCreator } from "postcss"

/** The cascade layer holding an app's own classes; the others are the page's (shell or kit stylesheet). */
const APP_LAYER = "utilities"

/**
 * Keeps only the `utilities` layer of Panda's output: the app's own atomic classes. The reset,
 * global styles, tokens and recipes are the page's already (the shell's stylesheet, or
 * `@mosaik/web-sdk/ui/styles.css`), and an app that repeated them would pin the theme to its build.
 * The layer order statement (`@layer reset, base, ...;`) stays, so the app's layer sorts as the
 * page's does.
 */
export const appLayerOnly: PluginCreator<void> = () => ({
  postcssPlugin: "mosaik:app-layer-only",
  OnceExit(root) {
    root.each((node) => {
      if (node.type === "atrule" && node.name === "layer" && node.nodes !== undefined && node.params !== APP_LAYER) {
        node.remove()
      }
    })
  },
})
appLayerOnly.postcss = true

/**
 * The PostCSS plugins of an app's styles, for `mosaikApp()`: Panda, then `appLayerOnly`. An app
 * without `panda.config.ts` has none of its own, so it gets none.
 */
export const appPostcssPlugins = (root: string): ReadonlyArray<AcceptedPlugin> =>
  existsSync(resolve(root, "panda.config.ts"))
    ? [panda({ cwd: root, configPath: "panda.config.ts" }), appLayerOnly()]
    : []
