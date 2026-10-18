import { makeApiClient } from "@mosaik/client"
import { NotificationsApi } from "@mosaik/notifications/contract"
import { infiniteQueryOptions, queryOptions } from "@tanstack/solid-query"

export const notificationsApi = makeApiClient(NotificationsApi)

export const notificationKeys = {
  all: ["notifications"] as const,
  inbox: (unreadOnly: boolean) => ["notifications", "inbox", unreadOnly ? "unread" : "all"] as const,
  latest: ["notifications", "inbox", "latest"] as const,
  unreadPreview: ["notifications", "inbox", "unread-preview"] as const,
  settings: ["notifications", "settings"] as const,
}

/** The few newest items, for the bell. */
export const latestQuery = () =>
  queryOptions({
    queryKey: notificationKeys.latest,
    queryFn: () => notificationsApi((client) => client.inbox.list({ query: { limit: 8 } })),
  })

/** The few newest unread items, for the overview. */
export const unreadPreviewQuery = () =>
  queryOptions({
    queryKey: notificationKeys.unreadPreview,
    queryFn: () => notificationsApi((client) => client.inbox.list({ query: { limit: 5, unread: "true" } })),
  })

export const inboxQuery = (unreadOnly: boolean) =>
  infiniteQueryOptions({
    queryKey: notificationKeys.inbox(unreadOnly),
    queryFn: ({ pageParam }) =>
      notificationsApi((client) =>
        client.inbox.list({ query: { before: pageParam, limit: 30, unread: unreadOnly ? "true" : undefined } }),
      ),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  })

export const settingsQuery = () =>
  queryOptions({
    queryKey: notificationKeys.settings,
    queryFn: () => notificationsApi((client) => client.settings.get()),
  })
