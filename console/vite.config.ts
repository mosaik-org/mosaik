import { join, relative, resolve } from "node:path"
import { tanstackRouter } from "@tanstack/router-plugin/vite"
import { index, layout, physical, rootRoute } from "@tanstack/virtual-file-routes"
import { defineConfig } from "vite"
import solid from "vite-plugin-solid"

const ROUTES = resolve(import.meta.dirname, "src/routes")

/**
 * Core's console pages (`@mosaik/console`), mounted at the same paths as in the Portal's shell,
 * under an `_app` layout like the shell's, so the pages' route ids are the same in both.
 */
const CONSOLE_ROUTES = resolve(import.meta.dirname, "../packages/console/src/routes")
const consoleRoutes = ["admin", "manage", "access-requests"].map((section) =>
  physical(`/${section}`, relative(ROUTES, join(CONSOLE_ROUTES, section))),
)

/** The console: Core's web UI for admins and app owners, when Mosaik runs without the Portal. */
export default defineConfig({
  plugins: [
    tanstackRouter({
      target: "solid",
      autoCodeSplitting: true,
      routesDirectory: ROUTES,
      generatedRouteTree: resolve(import.meta.dirname, "src/routeTree.gen.ts"),
      virtualRouteConfig: rootRoute("__root.tsx", [layout("app.tsx", [index("index.tsx"), ...consoleRoutes])]),
    }),
    solid(),
  ],
  resolve: {
    // Workspace packages resolve their own copies through symlinks; there must be one of each.
    dedupe: ["solid-js", "@tanstack/solid-router", "@tanstack/solid-query", "effect"],
  },
  server: {
    proxy: {
      "/api": { target: process.env.GATEWAY_URL ?? "http://localhost:3000", changeOrigin: false },
      // The MCP server for AI clients, and the OAuth metadata they find it with.
      "^/mcp$": { target: process.env.GATEWAY_URL ?? "http://localhost:3000", changeOrigin: false },
      "^/\\.well-known/oauth-": { target: process.env.GATEWAY_URL ?? "http://localhost:3000", changeOrigin: false },
    },
  },
  build: {
    target: "es2023",
    sourcemap: true,
  },
})
