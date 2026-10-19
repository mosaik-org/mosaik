import { createEventStream } from "@mosaik/client/solid"
import { Button, IconButton, Popover, Spinner } from "@mosaik/mosaik-ui"
import { InboxEvent, inboxLiveUrl } from "@mosaik/notifications/contract"
import { css } from "@mosaik/styled-system/css"
import { useQuery } from "@tanstack/solid-query"
import { Link } from "@tanstack/solid-router"
import Bell from "lucide-solid/icons/bell"
import BellOff from "lucide-solid/icons/bell-off"
import Settings from "lucide-solid/icons/settings"
import { createEffect, createSignal, on, Show } from "solid-js"
import { Portal } from "solid-js/web"
import { latestQuery } from "./api"
import { NotificationList, severityToast, useInboxActions } from "./NotificationList"

const styles = {
  // The panel's own layout: a header, the list and a footer, edge to edge.
  panel: css({ width: "22rem", maxWidth: "calc(100vw - 2rem)", p: "0", gap: "0", overflow: "hidden" }),
  trigger: css({ position: "relative" }),
  badge: css({
    position: "absolute",
    top: "0.5",
    insetEnd: "0.5",
    display: "grid",
    placeItems: "center",
    minW: "18px",
    h: "18px",
    px: "1",
    borderRadius: "full",
    bg: "danger.solid.bg",
    color: "white",
    fontSize: "10px",
    fontWeight: "bold",
    lineHeight: "1",
    pointerEvents: "none",
  }),
  header: css({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "2",
    px: "4",
    py: "3",
    borderBottomWidth: "1px",
    borderColor: "border",
  }),
  list: css({ overflowY: "auto", minH: "0", flex: "1" }),
  footer: css({
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    px: "4",
    py: "2.5",
    borderTopWidth: "1px",
    borderColor: "border",
    bg: "gray.2",
    fontSize: "sm",
  }),
  link: css({ color: "accent.plain.fg", fontWeight: "medium", _hover: { textDecoration: "underline" } }),
  empty: css({
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "2",
    py: "10",
    color: "fg.muted",
    fontSize: "sm",
  }),
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
              <span class={styles.badge} aria-hidden="true">
                {unread() > 99 ? "99+" : unread()}
              </span>
            </Show>
          </IconButton>
        )}
      />
      <Portal>
        <Popover.Positioner>
          <Popover.Content aria-label="Notifications" class={styles.panel}>
            <div class={styles.header}>
              <span class={css({ fontWeight: "semibold" })}>Notifications</span>
              <Show when={unread() > 0}>
                <Button
                  size="xs"
                  variant="plain"
                  loading={actions.markAllRead.isPending}
                  onClick={() => actions.markAllRead.mutate()}
                >
                  Mark all as read
                </Button>
              </Show>
            </div>
            <div class={styles.list}>
              <Show
                when={latest.data}
                fallback={
                  <div class={styles.empty}>
                    <Spinner />
                  </div>
                }
              >
                {(page) => (
                  <NotificationList
                    items={page().items}
                    onOpen={(item) => {
                      setOpen(false)
                      actions.open(item)
                    }}
                    empty={
                      <div class={styles.empty}>
                        <BellOff size={20} />
                        You're all caught up.
                      </div>
                    }
                  />
                )}
              </Show>
            </div>
            <div class={styles.footer}>
              <Link to="/notifications" class={styles.link} onClick={() => setOpen(false)}>
                View all
              </Link>
              <Link
                to="/notifications/settings"
                class={css({
                  display: "flex",
                  alignItems: "center",
                  gap: "1.5",
                  color: "fg.muted",
                  _hover: { color: "fg.default" },
                })}
                onClick={() => setOpen(false)}
              >
                <Settings size={14} />
                Settings
              </Link>
            </div>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  )
}
