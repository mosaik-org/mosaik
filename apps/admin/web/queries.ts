import { AdminApi } from "@mosaik/auth/contract"
import { makeApiClient } from "@mosaik/client"
import { type DeliveryStatus, NotificationsApi } from "@mosaik/notifications/contract"
import { PortalWebApi } from "@mosaik/portal/contract"
import { infiniteQueryOptions, queryOptions } from "@tanstack/solid-query"
import { admin } from "../manifest"

export const adminApi = makeApiClient(AdminApi)
/** Notifications admin (targets, routing, deliveries) is served by the notifications service. */
export const notificationsApi = makeApiClient(NotificationsApi)
/** Apps are installed and run by the Portal service. */
export const portalApi = makeApiClient(PortalWebApi)

export const adminKeys = {
  all: [admin.id] as const,
  users: [admin.id, "users"] as const,
  roles: [admin.id, "roles"] as const,
  catalog: [admin.id, "catalog"] as const,
  audit: (app: string | undefined) => [admin.id, "audit", app ?? "all"] as const,
  notifications: [admin.id, "notifications"] as const,
  apps: [admin.id, "apps"] as const,
  registries: [admin.id, "apps", "registries"] as const,
  usage: [admin.id, "usage"] as const,
  targets: [admin.id, "notifications", "targets"] as const,
  routes: [admin.id, "notifications", "routes"] as const,
  deliveries: (status: DeliveryStatus | undefined) =>
    [admin.id, "notifications", "deliveries", status ?? "all"] as const,
}

export const usersQuery = () =>
  queryOptions({ queryKey: adminKeys.users, queryFn: () => adminApi((client) => client.users.list()) })

export const rolesQuery = () =>
  queryOptions({ queryKey: adminKeys.roles, queryFn: () => adminApi((client) => client.roles.list()) })

export const catalogQuery = () =>
  queryOptions({ queryKey: adminKeys.catalog, queryFn: () => adminApi((client) => client.catalog.list()) })

export const auditQuery = (app: string | undefined) =>
  infiniteQueryOptions({
    queryKey: adminKeys.audit(app),
    queryFn: ({ pageParam }) =>
      adminApi((client) => client.audit.list({ query: { app, before: pageParam, limit: 50 } })),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  })

export const targetsQuery = () =>
  queryOptions({
    queryKey: adminKeys.targets,
    queryFn: () => notificationsApi((client) => client.admin.targets()),
  })

export const routesQuery = () =>
  queryOptions({
    queryKey: adminKeys.routes,
    queryFn: () => notificationsApi((client) => client.admin.routes()),
  })

export const deliveriesQuery = (status: DeliveryStatus | undefined) =>
  infiniteQueryOptions({
    queryKey: adminKeys.deliveries(status),
    queryFn: ({ pageParam }) =>
      notificationsApi((client) => client.admin.deliveries({ query: { status, before: pageParam, limit: 50 } })),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  })

export const appsQuery = () =>
  queryOptions({
    queryKey: adminKeys.apps,
    queryFn: () => portalApi((client) => client.admin.apps()),
    // Follow deployments while they run.
    refetchInterval: (query) =>
      query.state.data?.some((app) => app.status === "deploying" || app.status === "pending") ? 2000 : 15_000,
  })

export const registriesQuery = () =>
  queryOptions({
    queryKey: adminKeys.registries,
    queryFn: () => portalApi((client) => client.admin.registries()),
  })

export const usageQuery = () =>
  queryOptions({ queryKey: adminKeys.usage, queryFn: () => portalApi((client) => client.admin.usage()) })
