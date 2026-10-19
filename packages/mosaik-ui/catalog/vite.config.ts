import { resolve } from "node:path"
import { defineConfig } from "vite"
import solid from "vite-plugin-solid"

const library = resolve(import.meta.dirname, "..")

/**
 * The component catalog: every example of every component, against the library's sources (as an
 * app imports it, `@mosaik/mosaik-ui`). `bun run catalog` in the package.
 */
export default defineConfig({
  root: import.meta.dirname,
  plugins: [solid()],
  css: { postcss: resolve(import.meta.dirname, "postcss.config.mjs") },
  resolve: {
    alias: [
      { find: /^@mosaik\/mosaik-ui$/, replacement: resolve(library, "src/index.ts") },
      { find: /^styled-system\/(.*)$/, replacement: `${resolve(library, "styled-system")}/$1` },
    ],
  },
  server: { port: 6006, strictPort: true },
})
