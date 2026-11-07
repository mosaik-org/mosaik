import { defineConfig } from "@pandacss/dev"
import { pandaConfig } from "../packages/styled-system/panda.config"

/**
 * CSS extraction for the whole app: scans the shell, every shared UI package (Core's console too) and
 * every app's web code. Codegen lives in `@mosaik/styled-system`.
 */
export default defineConfig({
  ...pandaConfig,
  include: [
    "./src/**/*.{ts,tsx}",
    "../packages/{table,charts,web-kit,frame,console,assistant}/src/**/*.{ts,tsx}",
    "../apps/*/web/**/*.{ts,tsx}",
  ],
  exclude: ["./src/routeTree.gen.ts"],
  outdir: "../packages/styled-system/generated",
  outExtension: "mjs",
})
