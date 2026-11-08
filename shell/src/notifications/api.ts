import { makeApiClient } from "@mosaik/client"
import { NotificationsApi } from "@mosaik/notifications/contract"
import { infiniteQueryOptions, queryOptions } from "@tanstack/solid-query"
import { type InboxView, VIEWS } from "./model"

export const notificationsApi = makeApiClient(NotificationsApi)

export const notificationKeys = {
  all: ["notifications"] as const,
  /** One of the inbox's lists, of one app's items or everyone's. */
  view: (view: InboxView, source: string | undefined) =>
    ["notifications", "inbox", view, source ?? "all apps"] as const,
  /** Everything open, both kinds: the bell's. */
  open: ["notifications", "inbox", "open"] as const,
  item: (id: number) => ["notifications", "item", id] as const,
  preview: ["notifications", "inbox", "preview"] as const,
  settings: ["notifications", "settings"] as const,
}

const PAGE = 30

/** One of the inbox's lists, page by page, the newest first; one app's items with `source`. */
export const viewQuery = (view: InboxView, source: string | undefined) =>
  infiniteQueryOptions({
    queryKey: notificationKeys.view(view, source),
    queryFn: ({ pageParam }) =>
      notificationsApi((client) =>
        client.inbox.list({
          query: { state: VIEWS[view].state, kind: VIEWS[view].kind, source, before: pageParam, limit: PAGE },
        }),
      ),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  })

/** The newest open items of both kinds, and the counts: what the bell shows. */
export const openQuery = () =>
  queryOptions({
    queryKey: notificationKeys.open,
    queryFn: () => notificationsApi((client) => client.inbox.list({ query: { state: "open", limit: PAGE } })),
  })

/** One item with its history: what the reading pane shows. */
export const itemQuery = (id: number) =>
  queryOptions({
    queryKey: notificationKeys.item(id),
    queryFn: () => notificationsApi((client) => client.inbox.get({ params: { id } })),
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
