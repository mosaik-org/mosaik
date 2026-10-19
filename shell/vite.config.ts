import { existsSync, readdirSync } from "node:fs"
import { join, relative, resolve } from "node:path"
import { SHARED_MODULES, sharedSlug } from "@mosaik/app-kit/shared"
import { tanstackRouter } from "@tanstack/router-plugin/vite"
import { index, layout, physical, rootRoute, route } from "@tanstack/virtual-file-routes"
import { defineConfig, type Plugin } from "vite"
import solid from "vite-plugin-solid"

const ROOT = resolve(import.meta.dirname, "..")
const APPS = join(ROOT, "apps")
const ROUTES = resolve(import.meta.dirname, "src/routes")

/**
 * Every `apps/<id>/web/routes` directory is mounted at `/<id>`, so apps
 * own their pages while the shell gets one type-safe, code-split route tree.
 */
const appRouteDirs = readdirSync(APPS, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && existsSync(join(APPS, entry.name, "web/routes")))
  .map((entry) => ({ id: entry.name, dir: join(APPS, entry.name, "web/routes") }))

const appRoutes = appRouteDirs.map(({ id, dir }) => physical(`/${id}`, relative(ROUTES, dir)))

/**
 * Core's console pages (`@mosaik/console`): Administration, the apps people manage and access
 * requests, at the same paths as in the console app, so Core's links work with the Portal too.
 */
const CONSOLE_ROUTES = resolve(import.meta.dirname, "../packages/console/src/routes")
const consoleRoutes = ["admin", "manage", "access-requests"].map((section) =>
  physical(`/${section}`, relative(ROUTES, join(CONSOLE_ROUTES, section))),
)

/** Apps are discovered at startup; restart the dev server when one is added (`bun create:app`). */
const restartOnNewApp = (): Plugin => ({
  name: "mosaik:restart-on-new-app",
  apply: "serve",
  configureServer(server) {
    const known = new Set(appRouteDirs.map(({ dir }) => dir))
    server.watcher.add(APPS)
    server.watcher.on("addDir", (dir) => {
      if (/[\\/]web[\\/]routes$/.test(dir) && dir.startsWith(APPS) && !known.has(dir)) {
        server.config.logger.info(`New app found (${relative(APPS, dir)}), restarting`)
        void server.restart()
      }
    })
  },
})

const SHARED_DIR = resolve(import.meta.dirname, "src/shared")
const sharedEntry = (specifier: string) => join(SHARED_DIR, `${sharedSlug(specifier)}.ts`)

/**
 * Provides the shared modules (`@mosaik/app-kit/shared`) to installed apps through an
 * import map. Each module has a wrapper (`src/shared/*.ts`) that re-exports it.
 * - Build: the wrappers are extra entries of the same bundle, so they re-export the very
 *   modules the shell uses (one copy of Solid, the router, the UI kit...).
 * - Dev: the map points at the wrappers on the dev server, which import the same
 *   pre-bundled dependencies as the shell.
 */
const sharedModules = (): Plugin => ({
  name: "mosaik:shared-modules",
  config: () => ({
    build: {
      rolldownOptions: {
        input: {
          index: resolve(import.meta.dirname, "index.html"),
          ...Object.fromEntries(
            SHARED_MODULES.map((specifier) => [`shared/${sharedSlug(specifier)}`, sharedEntry(specifier)]),
          ),
        },
        // Keep the wrappers' exports: apps import them.
        preserveEntrySignatures: "exports-only",
      },
    },
  }),
  transformIndexHtml: {
    order: "post",
    handler(html, context) {
      const imports: Record<string, string> = {}
      for (const specifier of SHARED_MODULES) {
        if (context.bundle === undefined) {
          imports[specifier] = `/src/shared/${sharedSlug(specifier)}.ts`
          continue
        }
        const chunk = Object.values(context.bundle).find(
          (output) => output.type === "chunk" && output.facadeModuleId === sharedEntry(specifier),
        )
        if (chunk === undefined) throw new Error(`Shared module ${specifier} was not built`)
        imports[specifier] = `/${chunk.fileName}`
      }
      // Must come before any module script, so it replaces a placeholder at the top of <head>.
      return html.replace("<!--mosaik:importmap-->", `<script type="importmap">${JSON.stringify({ imports })}</script>`)
    },
  },
})

export default defineConfig({
  plugins: [
    sharedModules(),
    restartOnNewApp(),
    tanstackRouter({
      target: "solid",
      autoCodeSplitting: true,
      routesDirectory: ROUTES,
      generatedRouteTree: resolve(import.meta.dirname, "src/routeTree.gen.ts"),
      virtualRouteConfig: rootRoute("__root.tsx", [
        layout("app.tsx", [
          index("index.tsx"),
          route("/directory", [index("directory/index.tsx"), route("/$app", "directory/app.tsx")]),
          route("/notifications", [index("notifications/index.tsx"), route("/settings", "notifications/settings.tsx")]),
          ...consoleRoutes,
          ...appRoutes,
        ]),
      ]),
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
      // Installed apps' browser bundles.
      "^/apps/": { target: process.env.GATEWAY_URL ?? "http://localhost:3000", changeOrigin: false },
    },
  },
  build: {
    target: "es2023",
    sourcemap: true,
  },
})
