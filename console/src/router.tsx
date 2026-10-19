import { SESSION_QUERY_KEY } from "@mosaik/auth/web"
import { createQueryClient } from "@mosaik/client/solid"
import { css } from "@mosaik/styled-system/css"
import { EmptyState } from "@mosaik/ui"
import { createRouter } from "@tanstack/solid-router"
import SearchX from "lucide-solid/icons/search-x"
import { routeTree } from "./routeTree.gen"

export const queryClient = createQueryClient({
  // The session expired or was revoked: reload it, which re-runs the guard.
  onUnauthorized: () => {
    void queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY }).then(() => router.invalidate())
  },
})

export const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: "intent",
  // Loaders read through TanStack Query, which owns caching.
  defaultPreloadStaleTime: 0,
  scrollRestoration: true,
  defaultNotFoundComponent: () => (
    <div class={css({ py: "16" })}>
      <EmptyState icon={<SearchX size={32} />} title="Not found" description="There is no such page." />
    </div>
  ),
})

declare module "@tanstack/solid-router" {
  interface Register {
    router: typeof router
  }
}
