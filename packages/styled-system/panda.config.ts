import { type Config, defineConfig } from "@pandacss/dev"
import { prefix } from "@mosaik/mosaik-ui/preset"
import { mosaikPreset, mosaikUiPreset } from "./src/preset"

/**
 * What every Panda build of Mosaik's own code shares: `@mosaik/mosaik-ui`'s theme with Mosaik's
 * choices, and the library's prefix, so the CSS matches the class names its components write.
 * This package runs `panda codegen` for the typed runtime (`@mosaik/styled-system/css`, ...); the
 * shell and the console extract their CSS with it. Apps' own builds: `appPandaConfig` in `@mosaik/app-kit`.
 */
export const pandaConfig = {
  presets: [mosaikUiPreset, mosaikPreset],
  preflight: true,
  jsxFramework: "solid",
  importMap: "@mosaik/styled-system",
  prefix,
} satisfies Config

/** Mosaik's own components (on `@mosaik/mosaik-ui`), whose styles are compiled from their sources. */
export const KIT_SOURCES = ["web-kit", "table", "charts"].map((name) => `packages/${name}/src/**/*.{ts,tsx}`)

/**
 * This package: the typed runtime, and the kit's stylesheet (`@mosaik/styled-system/styles.css`,
 * `panda cssgen`): the library's styles and the kit's, for pages without the shell.
 */
export default defineConfig({
  ...pandaConfig,
  include: KIT_SOURCES.map((glob) => `../../${glob}`),
  exclude: ["../../packages/*/src/**/*.test.{ts,tsx}"],
  outdir: "generated",
  outExtension: "mjs",
})
