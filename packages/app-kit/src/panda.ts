import { pandaConfig } from "@mosaik/styled-system/panda"
import { mosaikPreset } from "@mosaik/styled-system/preset"
import presetBase from "@pandacss/preset-base"
import presetPanda from "@pandacss/preset-panda"

/** Where an app's Panda runtime is generated (`panda codegen`); `mosaikApp()` resolves `@mosaik/sdk/css` and its siblings to it. */
export const APP_STYLES_DIR = "styled-system"

/**
 * Panda config for an app: the platform preset, without the reset the shell already loads.
 * Class names and CSS variables get the app's prefix (`crm-…`): atomic classes of separate
 * builds must not collide, or one bundle's plain rules override the other's media queries.
 *
 * @example
 * // panda.config.ts
 * export default defineConfig(appPandaConfig({ prefix: "crm", include: ["./web/**\/*.{ts,tsx}"] }))
 */
export const appPandaConfig = (options: { readonly prefix: string; readonly include: ReadonlyArray<string> }) => ({
  ...pandaConfig,
  // The presets themselves, not their package names: Panda would look the names up from the
  // app's folder, where they are installed only if the package manager happened to hoist them.
  presets: [presetBase, presetPanda, mosaikPreset],
  preflight: false,
  prefix: options.prefix,
  // Apps import the runtime as `@mosaik/sdk/css` (and `/jsx`, `/patterns`); Panda extracts from those.
  importMap: "@mosaik/sdk",
  include: [...options.include],
  outdir: APP_STYLES_DIR,
  outExtension: "mjs" as const,
})
