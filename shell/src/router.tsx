import { SESSION_QUERY_KEY } from "@mosaik/auth/web"
import { createQueryClient } from "@mosaik/client/solid"
import { createRouter } from "@tanstack/solid-router"
import { AppError } from "./components/AppError"
import { NotFound } from "./components/NotFound"
import { routeTree } from "./routeTree.gen"

export const queryClient = createQueryClient({
  // The session expired or was revoked: reload it, which re-runs the route guards.
  onUnauthorized: () => {
    void queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY }).then(() => router?.invalidate())
  },
})

const makeRouter = () =>
  createRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: "intent",
    // Loaders read through TanStack Query, which owns caching.
    defaultPreloadStaleTime: 0,
    scrollRestoration: true,
    // Every route catches its own errors, so a failing page leaves the shell and the
    // app's navigation working, and a failing app leaves the others.
    defaultErrorComponent: AppError,
    // Shown inside the deepest layout of an unknown URL (the app's, or the shell's).
    defaultNotFoundComponent: NotFound,
  })

let router: ReturnType<typeof makeRouter> | undefined

/** Creates the router once installed apps have their placeholder routes (see `registerInstalledApps`). */
export const createAppRouter = () => {
  router = makeRouter()
  return router
}

/** The router, for code outside components (installed apps join the route tree when first opened). */
export const getRouter = () => {
  if (router === undefined) throw new Error("The router has not been created yet")
  return router
}

declare module "@tanstack/solid-router" {
  interface Register {
    router: ReturnType<typeof makeRouter>
  }
}
