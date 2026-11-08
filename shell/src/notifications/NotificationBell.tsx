import { createEventStream } from "@mosaik/client/solid"
import { Badge, EmptyState, IconButton, Popover, Spinner, Tooltip } from "@mosaik/mosaik-ui"
import { InboxEvent, inboxLiveUrl } from "@mosaik/notifications/contract"
import { css, cva } from "@mosaik/styled-system/css"
import { useQuery } from "@tanstack/solid-query"
import { Link } from "@tanstack/solid-router"
import Bell from "lucide-solid/icons/bell"
import BellOff from "lucide-solid/icons/bell-off"
import CheckCheck from "lucide-solid/icons/check-check"
import Inbox from "lucide-solid/icons/inbox"
import Settings from "lucide-solid/icons/settings"
import { createEffect, createSignal, on, Show, Suspense } from "solid-js"
import { Portal } from "solid-js/web"
import { useInboxActions } from "./actions"
import { openQuery } from "./api"
import { sectionsOf } from "./model"
import { NotificationList, severityToast } from "./NotificationList"

/**
 * On the bell's shoulder: how many things wait for the person, as a number, since each needs doing;
 * otherwise a dot while information is unread, which needs nothing. Red only for something critical, so
 * that red can be trusted; a ring of the page's colour keeps it apart from the icon.
 */
const mark = cva({
  base: {
    position: "absolute",
    top: "1",
    insetEnd: "1",
    display: "grid",
    placeItems: "center",
    minW: "2",
    h: "2",
    borderRadius: "full",
    pointerEvents: "none",
    outline: "2px solid token(colors.canvas)",
    fontSize: "2xs",
    fontWeight: "semibold",
    lineHeight: "1",
    fontVariantNumeric: "tabular-nums",
    "&[data-count]": { minW: "4", h: "4", px: "1", top: "0.5", insetEnd: "0.5" },
  },
  variants: {
    critical: {
      true: { bg: "danger.solid.bg", color: "danger.solid.fg" },
      false: { bg: "accent.solid.bg", color: "accent.solid.fg" },
    },
  },
})

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
  header: css({ display: "flex", alignItems: "center", gap: "1", px: "4", py: "2.5", borderBottomWidth: "1px" }),
  title: css({ flex: "1", display: "flex", alignItems: "center", gap: "2", fontSize: "sm", fontWeight: "semibold" }),
  list: css({ overflowY: "auto", minH: "0", flex: "1" }),
  loading: css({ display: "grid", placeItems: "center", py: "10" }),
}

/**
 * The header's notification bell: how many things wait for the person, what is open in its panel, and
 * live updates (a toast for every new notification). Rendered for logged-in users only.
 */
export const NotificationBell = () => {
  const [open, setOpen] = createSignal(false)
  const actions = useInboxActions()
  const live = createEventStream(inboxLiveUrl, InboxEvent)
  // What is open, and nothing else: everything is on the notifications page. Loaded with the bell, so
  // opening never waits.
  const inbox = useQuery(openQuery)
  const items = () => inbox.data?.items ?? []
  const counts = () => live.data()?.counts ?? inbox.data?.counts
  const todo = () => counts()?.actions ?? 0
  const unread = () => counts()?.unread ?? 0

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

  // Among the newest page: one older than that does not turn the bell red, and is rarely still news.
  const critical = () => items().some((item) => item.readAt === null && item.content.severity === "critical")
  const label = () => {
    const parts = [
      ...(todo() > 0 ? [`${todo()} to do`] : []),
      ...(unread() > 0 ? [`${unread()} unread`] : []),
      ...(critical() ? ["some critical"] : []),
    ]
    return parts.length === 0 ? "Notifications" : `Notifications (${parts.join(", ")})`
  }
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
            <Show
              when={todo() > 0}
              fallback={
                <Show when={unread() > 0}>
                  <span class={mark({ critical: critical() })} aria-hidden="true" />
                </Show>
              }
            >
              <span class={mark({ critical: critical() })} data-count aria-hidden="true">
                {todo() > 9 ? "9+" : todo()}
              </span>
            </Show>
          </IconButton>
        )}
      />
      <Portal>
        <Popover.Positioner>
          <Popover.Content aria-label="Notifications" class={styles.panel}>
            <div class={styles.header}>
              <span class={styles.title}>
                Inbox
                <Show when={todo() > 0}>
                  <Badge size="sm" colorPalette="gray">
                    <span class={css({ srOnly: true })}>To do: </span>
                    {todo() > 99 ? "99+" : todo()}
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
                    sections={sectionsOf(items(), "kind", Date.now())}
                    lines={1}
                    actions={actions}
                    onOpen={(item) => {
                      close()
                      actions.show(item)
                    }}
                    empty={
                      <EmptyState
                        icon={<BellOff />}
                        title="You're all caught up"
                        description="Nothing waits for you."
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
