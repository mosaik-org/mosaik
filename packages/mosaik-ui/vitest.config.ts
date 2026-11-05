import { resolve } from "node:path"
import solid from "vite-plugin-solid"
import { defineConfig } from "vitest/config"

/** The components in a DOM (jsdom): behavior, the field contract and accessibility. */
export default defineConfig({
  plugins: [solid()],
  resolve: {
    conditions: ["browser", "development"],
    // The catalog's examples import the package as an app does.
    alias: [
      { find: /^@mosaik\/mosaik-ui$/, replacement: resolve(import.meta.dirname, "src/index.ts") },
      { find: /^styled-system\/(.*)$/, replacement: `${resolve(import.meta.dirname, "styled-system")}/$1` },
    ],
  },
  test: {
    name: "mosaik-ui",
    // The tests list the examples with `import.meta.glob`: cached, a new example would go untested.
    fsModuleCache: false,
    root: import.meta.dirname,
    environment: "jsdom",
    include: ["src/**/*.test.tsx", "test/**/*.test.tsx"],
    exclude: ["test/**/*.server.test.{ts,tsx}"],
    setupFiles: ["./test/setup.ts"],
  },
})
