import { makeApiClient } from "@mosaik/client"
import { PortalWebApi } from "@mosaik/portal/contract"
import { queryOptions } from "@tanstack/solid-query"
import { portal } from "../manifest"

/** Apps are installed and run by the Portal service. */
export const portalApi = makeApiClient(PortalWebApi)

export const portalKeys = {
  all: [portal.id] as const,
  apps: [portal.id, "apps"] as const,
  registries: [portal.id, "apps", "registries"] as const,
  usage: [portal.id, "usage"] as const,
}

export const appsQuery = () =>
  queryOptions({
    queryKey: portalKeys.apps,
    queryFn: () => portalApi((client) => client.admin.apps()),
    // Follow deployments while they run.
    refetchInterval: (query) =>
      query.state.data?.some((app) => app.status === "deploying" || app.status === "pending") ? 2000 : 15_000,
  })

export const registriesQuery = () =>
  queryOptions({
    queryKey: portalKeys.registries,
    queryFn: () => portalApi((client) => client.admin.registries()),
  })

export const usageQuery = () =>
  queryOptions({ queryKey: portalKeys.usage, queryFn: () => portalApi((client) => client.admin.usage()) })
