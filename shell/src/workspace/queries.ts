import { queryOptions } from "@tanstack/solid-query"
import { platformApi } from "../platformApi"
import { portalApi } from "../portalApi"

/** Per user, so another account on the same browser never sees them. */
export const workspaceKeys = {
  all: ["workspace"] as const,
  myApps: (user: string) => ["workspace", user, "apps"] as const,
  accessRequests: (user: string) => ["workspace", user, "access-requests"] as const,
  popularity: ["workspace", "popularity"] as const,
}

export const myAppsQuery = (user: string) =>
  queryOptions({
    queryKey: workspaceKeys.myApps(user),
    queryFn: () => portalApi((client) => client.workspace.apps()),
    // The shell keeps it current itself (pins, opens); refetching only picks up other devices.
    staleTime: 5 * 60_000,
  })

export const accessRequestsQuery = (user: string) =>
  queryOptions({
    queryKey: workspaceKeys.accessRequests(user),
    queryFn: () => platformApi((client) => client.access.mine()),
  })

export const popularityQuery = () =>
  queryOptions({
    queryKey: workspaceKeys.popularity,
    queryFn: () => portalApi((client) => client.workspace.popularity()),
    staleTime: 10 * 60_000,
  })
