import { createEventStream } from "@mosaik/client/solid"
import { Badge, EmptyState, IconButton, Popover, Spinner, Tooltip } from "@mosaik/mosaik-ui"
import { InboxEvent, inboxLiveUrl } from "@mosaik/notifications/contract"
import { css } from "@mosaik/styled-system/css"
import { useInfiniteQuery, useQuery } from "@tanstack/solid-query"
import { Link } from "@tanstack/solid-router"
import Bell from "lucide-solid/icons/bell"
import BellOff from "lucide-solid/icons/bell-off"
import CheckCheck from "lucide-solid/icons/check-check"
import Inbox from "lucide-solid/icons/inbox"
import Settings from "lucide-solid/icons/settings"
import { createEffect, createSignal, on, Show, Suspense } from "solid-js"
import { Portal } from "solid-js/web"
import { inboxQuery, latestQuery } from "./api"
import { NotificationList, severityToast, useInboxActions } from "./NotificationList"

const styles = {
  // A header and the list under it, edge to edge; no taller than about ten rows, the list
  // scrolling under the header.
  panel: css({
    display: "flex",
    flexDirection: "column",
    width: "24rem",
    maxWidth: "calc(100vw - 2rem)",
    maxHeight: "min(32rem, calc(100dvh - 5rem))",
    p: "0",
    gap: "0",
    overflow: "hidden",
  }),
  trigger: css({ position: "relative" }),
  // On the button's corner, overhanging it so the bell stays in sight; a ring of the page's colour
  // keeps it apart from the icon.
  badge: css({
    position: "absolute",
    top: "-1",
    insetEnd: "-1",
    pointerEvents: "none",
    outline: "2px solid token(colors.canvas)",
  }),
  header: css({ display: "flex", alignItems: "center", gap: "1", px: "4", py: "2.5", borderBottomWidth: "1px" }),
  title: css({ flex: "1", display: "flex", alignItems: "center", gap: "2", fontSize: "sm", fontWeight: "semibold" }),
  list: css({ overflowY: "auto", minH: "0", flex: "1" }),
  loading: css({ display: "grid", placeItems: "center", py: "10" }),
}

/**
 * The header's notification bell: unread count, the newest items and live updates
 * (a toast for every new notification). Rendered for logged-in users only.
 */
export const NotificationBell = () => {
  const [open, setOpen] = createSignal(false)
  const latest = useQuery(latestQuery)
  const actions = useInboxActions()
  const live = createEventStream(inboxLiveUrl, InboxEvent)
  const unread = () => live.data()?.unread ?? latest.data?.unread ?? 0

  createEffect(
    on(live.data, (event) => {
      if (event === undefined) return
      // Counts change on reads in other tabs too: refresh the lists either way.
      void actions.invalidate()
      if (event.item !== null && !open()) {
        severityToast(event.item.content.severity)(event.item.content.title, event.item.content.body?.split("\n")[0])
      }
    }),
  )

  const label = () => (unread() > 0 ? `Notifications (${unread()} unread)` : "Notifications")

  // What is new, and nothing else: everything, read or not, is on the notifications page. Loaded
  // with the bell (the newest page, shared with that page's Unread tab), so opening never waits.
  const inbox = useInfiniteQuery(() => inboxQuery(true))
  const items = () => inbox.data?.pages[0]?.items ?? []
  const close = () => setOpen(false)

  return (
    <Popover.Root
      open={open()}
      onOpenChange={(details) => setOpen(details.open)}
      positioning={{ placement: "bottom-end" }}
    >
      <Popover.Trigger
        asChild={(trigger) => (
          <IconButton {...trigger()} variant="plain" aria-label={label()} class={styles.trigger}>
            <Bell size={18} />
            <Show when={unread() > 0}>
              <Badge variant="solid" colorPalette="danger" size="sm" class={styles.badge} aria-hidden="true">
                {unread() > 99 ? "99+" : unread()}
              </Badge>
            </Show>
          </IconButton>
        )}
      />
      <Portal>
        <Popover.Positioner>
          <Popover.Content aria-label="Notifications" class={styles.panel}>
            <div class={styles.header}>
              <span class={styles.title}>
                Notifications
                <Show when={unread() > 0}>
                  <Badge size="sm" colorPalette="gray">
                    <span class={css({ srOnly: true })}>Unread: </span>
                    {unread() > 99 ? "99+" : unread()}
                  </Badge>
                </Show>
              </span>
              <Show when={unread() > 0}>
                <Tooltip content="Mark all as read">
                  {(tip) => (
                    <IconButton
                      {...tip()}
                      size="xs"
                      variant="plain"
                      aria-label="Mark all as read"
                      loading={actions.markAllRead.isPending}
                      onClick={() => actions.markAllRead.mutate()}
                    >
                      <CheckCheck size={16} />
                    </IconButton>
                  )}
                </Tooltip>
              </Show>
              <Tooltip content="All notifications">
                {(tip) => (
                  <IconButton
                    {...tip()}
                    size="xs"
                    variant="plain"
                    aria-label="All notifications"
                    asChild={(link) => (
                      <Link to="/notifications" {...link()} onClick={close}>
                        <Inbox size={16} />
                      </Link>
                    )}
                  />
                )}
              </Tooltip>
              <Tooltip content="Notification settings">
                {(tip) => (
                  <IconButton
                    {...tip()}
                    size="xs"
                    variant="plain"
                    aria-label="Notification settings"
                    asChild={(link) => (
                      <Link to="/notifications/settings" {...link()} onClick={close}>
                        <Settings size={16} />
                      </Link>
                    )}
                  />
                )}
              </Tooltip>
            </div>
            <div class={styles.list}>
              {/* Its own boundary: a list waiting for its data shows a spinner here, and does not suspend
                  the panel, which would then never be placed under its button. */}
              <Suspense
                fallback={
                  <div class={styles.loading}>
                    <Spinner />
                  </div>
                }
              >
                <Show
                  when={inbox.data}
                  fallback={
                    <div class={styles.loading}>
                      <Spinner />
                    </div>
                  }
                >
                  <NotificationList
                    items={items()}
                    lines={1}
                    onOpen={(item) => {
                      close()
                      actions.open(item)
                    }}
                    onMarkRead={(item) => actions.markRead.mutate([item.id])}
                    unreadOnly
                    empty={
                      <EmptyState
                        icon={<BellOff />}
                        title="You're all caught up"
                        description="Nothing new since you last looked."
                      />
                    }
                  />
                </Show>
              </Suspense>
            </div>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  )
}
