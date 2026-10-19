import type { AnyRoute } from "@tanstack/solid-router"
import type { Component } from "solid-js"

/**
 * What an app's browser bundle default-exports. The shell mounts it at `/<id>` when the
 * app is installed (no shell rebuild), and loads it the first time someone opens the app.
 *
 * To search the app's data from the command palette, default-export `defineSearchProvider(...)`
 * from `web/search.ts`: it is built as a separate file, loaded the first time the palette is used.
 *
 * @example
 * export default defineWebApp({
 *   component: () => <AppLayout app={crm} nav={[...]} />,
 *   routes: (parent) => [
 *     createRoute({ getParentRoute: () => parent, path: "/", component: lazyRouteComponent(() => import("./pages/home")) }),
 *   ],
 * })
 */
export interface WebApp {
  /** Wraps every page (e.g. `AppLayout` with sub-navigation). Defaults to an outlet. */
  readonly component?: Component
  /**
   * The app's pages under `/<id>`, created with `createRoute({ getParentRoute: () => parent, path })`.
   * Load pages lazily (`lazyRouteComponent`) so opening the app only loads the page shown.
   */
  readonly routes: (parent: AnyRoute) => ReadonlyArray<AnyRoute>
}

export const defineWebApp = (app: WebApp): WebApp => app
