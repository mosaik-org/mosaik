import { pandaConfig } from "@mosaik/styled-system/panda"
import { mosaikPreset, mosaikTokensPreset } from "@mosaik/styled-system/preset"

/** Where an app's Panda runtime is generated (`panda codegen`); `mosaikApp()` resolves `@mosaik/sdk/css` and its siblings to it. */
export const APP_STYLES_DIR = "styled-system"

/**
 * Panda config for an app's own styles: the platform's theme, without the reset and the kit's
 * recipes, which the page has already (the shell's stylesheet, or `@mosaik/sdk/ui/styles.css`).
 * Class names and CSS variables get the app's prefix (`crm-…`): atomic classes of separate
 * builds must not collide, or one bundle's plain rules override the other's media queries.
 *
 * @example
 * // panda.config.ts
 * export default defineConfig(appPandaConfig({ prefix: "crm", include: ["./web/**\/*.{ts,tsx}"] }))
 */
export const appPandaConfig = (options: { readonly prefix: string; readonly include: ReadonlyArray<string> }) => ({
  ...pandaConfig,
  presets: [mosaikTokensPreset, mosaikPreset],
  preflight: false,
  prefix: options.prefix,
  // Apps import the runtime as `@mosaik/sdk/css` (and `/jsx`, `/patterns`); Panda extracts from those.
  importMap: "@mosaik/sdk",
  include: [...options.include],
  outdir: APP_STYLES_DIR,
  outExtension: "mjs" as const,
})
