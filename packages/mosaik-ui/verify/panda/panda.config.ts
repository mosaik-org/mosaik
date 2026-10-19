import { defineConfig } from "@pandacss/dev"

// An app that runs Panda: the library's theme and recipes come with `designSystem`.
export default defineConfig({
  designSystem: "@mosaik/mosaik-ui",
  preflight: true,
  include: ["./src/**/*.{ts,tsx}"],
  jsxFramework: "solid",
})
