import { pandaConfig } from "@mosaik/styled-system/panda"
import { mosaikPreset, mosaikTokensPreset } from "@mosaik/styled-system/preset"

/** Where an app's Panda runtime is generated (`panda codegen`); `mosaikApp()` resolves `@mosaik/sdk/css` and its siblings to it. */
export const APP_STYLES_DIR = "styled-system"

/**
 * Panda config for an app's own styles. The app knows the platform's theme (its token names, for
 * types) but defines none of it: its classes read the page's variables (`--mk-…`), so a theme
 * set at runtime, dark mode included, reaches them. `mosaikApp()` keeps only those classes from
 * Panda's output; the reset, tokens and the kit's recipes are the page's (the shell's stylesheet,
 * or `@mosaik/sdk/ui/styles.css`).
 *
 * Class names get the app's prefix (`crm-…`): atomic classes of separate builds must not collide,
 * or one bundle's plain rules override the other's media queries. Token names are a contract with
 * the page: see `packages/styled-system/token-names.txt`.
 *
 * @example
 * // panda.config.ts
 * export default defineConfig(appPandaConfig({ prefix: "crm", include: ["./web/**\/*.{ts,tsx}"] }))
 */
export const appPandaConfig = (options: { readonly prefix: string; readonly include: ReadonlyArray<string> }) => ({
  ...pandaConfig,
  presets: [mosaikTokensPreset, mosaikPreset],
  preflight: false,
  // The app's classes, the theme's variables.
  prefix: { className: options.prefix, cssVar: pandaConfig.prefix },
  // Apps import the runtime as `@mosaik/sdk/css` (and `/jsx`, `/patterns`); Panda extracts from those.
  importMap: "@mosaik/sdk",
  include: [...options.include],
  outdir: APP_STYLES_DIR,
  outExtension: "mjs" as const,
})
