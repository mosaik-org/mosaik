import { defineConfig } from "@pandacss/dev"
import { prefix, preset } from "./src/theme"

/**
 * The library's own build: codegen for its components (`styled-system/`, imported by `src/`) and
 * the stylesheet apps without Panda load. The preset carries everything the stylesheet holds
 * (`staticCss`), so scanning `src/` adds nothing (`test/stylesheet.server.test.ts` checks it).
 */
export default defineConfig({
  presets: [preset],
  preflight: true,
  include: ["./src/**/*.{ts,tsx}"],
  exclude: ["./src/**/*.test.tsx"],
  outdir: "styled-system",
  jsxFramework: "solid",
  prefix,
})
