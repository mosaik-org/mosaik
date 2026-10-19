import { resolve } from "node:path"
import solid from "vite-plugin-solid"
import { defineConfig } from "vitest/config"

/** The components rendered to HTML on the server, as SolidStart apps do. */
export default defineConfig({
  plugins: [solid({ ssr: true })],
  resolve: {
    alias: [
      { find: /^@mosaik\/mosaik-ui$/, replacement: resolve(import.meta.dirname, "src/index.ts") },
      { find: /^styled-system\/(.*)$/, replacement: `${resolve(import.meta.dirname, "styled-system")}/$1` },
    ],
  },
  test: {
    name: "mosaik-ui-server",
    root: import.meta.dirname,
    environment: "node",
    include: ["test/**/*.server.test.tsx"],
    server: { deps: { inline: [/@ark-ui/, /solid-js/] } },
  },
})
