import { type Config, defineConfig } from "@pandacss/dev"
import { prefix } from "@mosaik/ui/theme"
import { mosaikPreset, mosaikUiPreset } from "./src/preset"

/**
 * `@mosaik/ui`'s components, whose inline styles (`css()`, style props) a build that makes the
 * library's stylesheet compiles from their sources, as it does Mosaik's: they import the library's
 * runtime as `@mosaik/ui/styled-system`, which `importMap` names. The path is the build's own: each
 * declares `@mosaik/ui`.
 */
export const UI_SOURCES = "./node_modules/@mosaik/ui/dist/**/*.{js,jsx}"

/**
 * What every Panda build of Mosaik's own code shares: `@mosaik/ui`'s theme with Mosaik's choices, and
 * the library's prefix, so the CSS matches the class names its components write.
 * This package runs `panda codegen` for the typed runtime (`@mosaik/styled-system/css`, ...); the
 * shell and the console extract their CSS with it. Apps' own builds: `appPandaConfig` in `@mosaik/app-kit`.
 */
export const pandaConfig = {
  presets: [mosaikUiPreset, mosaikPreset],
  preflight: true,
  jsxFramework: "solid",
  // Mosaik's runtime, and the library's: Panda extracts the styles of code importing either.
  importMap: ["@mosaik/styled-system", "@mosaik/ui/styled-system"],
  prefix,
} satisfies Config

/** Mosaik's own components (on `@mosaik/ui`), whose styles are compiled from their sources. */
export const KIT_SOURCES = ["web-kit", "table", "charts"].map((name) => `packages/${name}/src/**/*.{ts,tsx}`)

/**
 * This package: the typed runtime, and the kit's stylesheet (`@mosaik/styled-system/styles.css`,
 * `panda cssgen`): the library's styles and the kit's, for pages without the shell.
 */
export default defineConfig({
  ...pandaConfig,
  include: [UI_SOURCES, ...KIT_SOURCES.map((glob) => `../../${glob}`)],
  exclude: ["../../packages/*/src/**/*.test.{ts,tsx}"],
  outdir: "generated",
  outExtension: "mjs",
})
