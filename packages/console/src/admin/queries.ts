import { admin } from "@mosaik/auth/contract"
import type { DeliveryStatus } from "@mosaik/notifications/contract"
import { infiniteQueryOptions, queryOptions } from "@tanstack/solid-query"
import { adminApi, administration, notificationsApi } from "../api"

export const adminKeys = {
  all: [admin.id] as const,
  users: [admin.id, "users"] as const,
  roles: [admin.id, "roles"] as const,
  catalog: [admin.id, "catalog"] as const,
  audit: (app: string | undefined) => [admin.id, "audit", app ?? "all"] as const,
  notifications: [admin.id, "notifications"] as const,
  targets: [admin.id, "notifications", "targets"] as const,
  routes: [admin.id, "notifications", "routes"] as const,
  deliveries: (status: DeliveryStatus | undefined) =>
    [admin.id, "notifications", "deliveries", status ?? "all"] as const,
}

// Keyed by the contract (`["admin", "users", "list"]`): under `adminKeys.users`, so invalidating that refetches it.
export const usersQuery = () => administration.users.list.query()

export const rolesQuery = () => administration.roles.list.query()

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
