import { makeApiClient } from "@mosaik/client"
import { type InboxState, NotificationsApi } from "@mosaik/notifications/contract"
import { infiniteQueryOptions, queryOptions } from "@tanstack/solid-query"

export const notificationsApi = makeApiClient(NotificationsApi)

export const notificationKeys = {
  all: ["notifications"] as const,
  inbox: (state: InboxState) => ["notifications", "inbox", state] as const,
  preview: ["notifications", "inbox", "preview"] as const,
  settings: ["notifications", "settings"] as const,
}

/** Items in one state, page by page, the newest first (the bell's panel shows the first page of open ones). */
export const inboxQuery = (state: InboxState) =>
  infiniteQueryOptions({
    queryKey: notificationKeys.inbox(state),
    queryFn: ({ pageParam }) =>
      notificationsApi((client) => client.inbox.list({ query: { state, before: pageParam, limit: 30 } })),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  })

/** The few newest open items, for the overview. */
export const previewQuery = () =>
  queryOptions({
    queryKey: notificationKeys.preview,
    queryFn: () => notificationsApi((client) => client.inbox.list({ query: { state: "open", limit: 5 } })),
  })

export const settingsQuery = () =>
  queryOptions({
    queryKey: notificationKeys.settings,
    queryFn: () => notificationsApi((client) => client.settings.get()),
  })
