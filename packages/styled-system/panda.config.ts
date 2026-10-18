import { type Config, defineConfig } from "@pandacss/dev"
import { mosaikPreset } from "./src/preset"

/**
 * Shared Panda config. This package runs `panda codegen` to produce the typed
 * styled-system runtime (`@mosaik/styled-system/css`, `/jsx`, ...). CSS extraction
 * happens in the shell, which scans every package that uses it, and in each installed app
 * (`appPandaConfig` in `@mosaik/app-kit`).
 */
export const pandaConfig = {
  presets: ["@pandacss/preset-base", "@pandacss/preset-panda", mosaikPreset],
  preflight: true,
  jsxFramework: "solid",
  importMap: "@mosaik/styled-system",
} satisfies Config

export default defineConfig({
  ...pandaConfig,
  include: [],
  outdir: "generated",
  outExtension: "mjs",
})
