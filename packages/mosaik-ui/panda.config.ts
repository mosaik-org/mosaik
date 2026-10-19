import { defineConfig } from "@pandacss/dev"
import { palettes, preset, roleNames } from "./src/theme"

/**
 * The library's own build: codegen for its components (`styled-system/`, imported by `src/`) and
 * the stylesheet apps without Panda load. Every recipe variant and every palette is compiled, since
 * those apps never scan the components.
 */
export default defineConfig({
  presets: [preset],
  preflight: true,
  include: ["./src/**/*.{ts,tsx}"],
  outdir: "styled-system",
  jsxFramework: "solid",
  // Class names and CSS variables of an app's own Panda build cannot collide with the library's.
  prefix: "mk",
  staticCss: {
    recipes: "*",
    css: [{ properties: { colorPalette: [...Object.keys(palettes), ...roleNames] } }],
  },
})
