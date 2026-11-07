import { defineConfig } from "@pandacss/dev"
import { pandaConfig } from "../packages/styled-system/panda.config"

/** CSS extraction for the console: its frame, Core's console pages and the UI packages they use. */
export default defineConfig({
  ...pandaConfig,
  include: ["./src/**/*.{ts,tsx}", "../packages/{table,charts,web-kit,frame,console,assistant}/src/**/*.{ts,tsx}"],
  exclude: ["./src/routeTree.gen.ts"],
  outdir: "../packages/styled-system/generated",
  outExtension: "mjs",
})
