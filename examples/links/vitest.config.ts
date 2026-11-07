import { defineConfig } from "vitest/config"

/**
 * `bun run test`: the app's tests, with the SDK's testing kit (`@mosaik/sdk/testing`). The SDK ships
 * TypeScript sources, which Node (running the tests) will not load from node_modules: Vitest compiles
 * it with the tests instead.
 */
export default defineConfig({ test: { server: { deps: { inline: [/node_modules\/@mosaik\/sdk\//] } } } })
