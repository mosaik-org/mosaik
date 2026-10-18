import { namespacesGranting, OWNER_PERMISSION_NAME, type Principal } from "@mosaik/core"
import { AccessAdmin, type AccessRequestStatus } from "@mosaik/platform/contract"
import { queryOptions } from "@tanstack/solid-query"
import { platformApi } from "../platformApi"
import { portalApi } from "../portalApi"

export interface ReviewFilter {
  readonly status?: AccessRequestStatus | undefined
  readonly app?: string | undefined
}

/** Per user, so another account on the same browser never sees them. */
export const accessKeys = {
  all: (user: string) => ["access", user] as const,
  about: (app: string) => ["access", "about", app] as const,
  members: (user: string, app: string) => ["access", user, "members", app] as const,
  usage: (user: string, app: string) => ["access", user, "usage", app] as const,
  people: (user: string, app: string, query: string) => ["access", user, "people", app, query] as const,
  reviews: (user: string, filter: ReviewFilter) =>
    ["access", user, "reviews", filter.app ?? "all", filter.status ?? "all"] as const,
}

/** An app's roles and owners, for anyone logged in. */
export const aboutQuery = (app: string) =>
  queryOptions({
    queryKey: accessKeys.about(app),
    queryFn: () => platformApi((client) => client.apps.about({ params: { id: app } })),
  })

export const membersQuery = (user: string, app: string) =>
  queryOptions({
    queryKey: accessKeys.members(user, app),
    queryFn: () => platformApi((client) => client.apps.members({ params: { id: app } })),
  })

export const appUsageQuery = (user: string, app: string) =>
  queryOptions({
    queryKey: accessKeys.usage(user, app),
    queryFn: () => portalApi((client) => client.directory.usage({ params: { id: app } })),
  })

/** Requests the user may answer. */
export const reviewsQuery = (user: string, filter: ReviewFilter) =>
  queryOptions({
    queryKey: accessKeys.reviews(user, filter),
    queryFn: () => platformApi((client) => client.accessReview.list({ query: { ...filter } })),
  })

/** Whether the user decides who can use at least one app (an owner somewhere, or an admin). */
export const managesAnyApp = (principal: Principal): boolean => {
  if (principal.can(AccessAdmin.manage)) return true
  const owned = namespacesGranting(principal.grants, OWNER_PERMISSION_NAME)
  return owned === "all" || owned.size > 0
}
