import { errorMessage, toast } from "@mosaik/client"
import { AppIcon, appColor } from "@mosaik/frame"
import { IconButton, Tooltip } from "@mosaik/mosaik-ui"
import type { InboxItem, Severity } from "@mosaik/notifications/contract"
import { css, cva } from "@mosaik/styled-system/css"
import { useMutation, useQueryClient } from "@tanstack/solid-query"
import { useRouter } from "@tanstack/solid-router"
import Bell from "lucide-solid/icons/bell"
import Check from "lucide-solid/icons/check"
import { For, type JSX, Show } from "solid-js"
import { sourceApp, sourceName } from "../apps"
import { notificationKeys, notificationsApi } from "./api"
import { groupByDay, shortAgo } from "./time"

/** A warning or critical notification's icon takes their colour; Mosaik's own (platform) is quiet. */
const sourceIcon = cva({
  base: { display: "flex", flexShrink: "0", color: "fg.muted" },
  variants: {
    severity: {
      warning: { color: "warning.plain.fg" },
      critical: { color: "danger.plain.fg" },
    },
  },
})

const styles = {
  groups: css({ display: "flex", flexDirection: "column", gap: "2", py: "2" }),
  heading: css({
    px: "4",
    pb: "1",
    fontSize: "xs",
    fontWeight: "semibold",
    color: "fg.muted",
    textTransform: "uppercase",
    letterSpacing: "wider",
  }),
  row: css({
    position: "relative",
    _hover: { bg: "gray.subtle.bg" },
    // The row's action shows on hover and keyboard focus, over its time and dot.
    "&:hover > [data-actions], &:focus-within > [data-actions]": { opacity: "1", pointerEvents: "auto" },
    // Where it shows, the time and the dot make way for it.
    "&:has(> [data-actions]):is(:hover, :focus-within) [data-trailing]": { visibility: "hidden" },
  }),
  item: css({
    display: "flex",
    alignItems: "center",
    gap: "3",
    w: "full",
    px: "4",
    py: "2",
    textAlign: "start",
    cursor: "pointer",
    _focusVisible: { outline: "2px solid", outlineColor: "accent.solid.bg", outlineOffset: "-2px" },
  }),
  text: css({ display: "flex", flexDirection: "column", minW: "0", flex: "1" }),
  line: css({ display: "flex", alignItems: "baseline", gap: "2", minW: "0" }),
  title: css({
    flex: "1",
    minW: "0",
    truncate: true,
    fontSize: "sm",
    fontWeight: "medium",
    "&[data-unread=true]": { fontWeight: "semibold" },
    "&[data-unread=false]": { color: "fg.muted", fontWeight: "normal" },
  }),
  time: css({ flexShrink: "0", fontSize: "xs", color: "fg.muted", fontVariantNumeric: "tabular-nums" }),
  preview: css({
    fontSize: "xs",
    color: "fg.muted",
    "&[data-lines='1']": { truncate: true },
    "&[data-lines='2']": { lineClamp: "2" },
  }),
  unread: css({ flexShrink: "0", boxSize: "2", borderRadius: "full", bg: "accent.solid.bg" }),
  actions: css({
    position: "absolute",
    top: "50%",
    insetEnd: "3",
    transform: "translateY(-50%)",
    opacity: "0",
    pointerEvents: "none",
    transition: "opacity 0.15s",
  }),
}

/** First paragraph of the body, for previews. */
const preview = (body: string | undefined) => body?.split(/\n\s*\n/)[0]?.trim()

export const severityToast = (severity: Severity | undefined) =>
  severity === "critical" ? toast.error : severity === "success" ? toast.success : toast.info

/** Mark read and follow links. */
export const useInboxActions = () => {
  const queryClient = useQueryClient()
  const router = useRouter()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: notificationKeys.all })
  const onError = (error: unknown) => toast.error("Could not update notifications", errorMessage(error))

  const markRead = useMutation(() => ({
    mutationFn: (ids: ReadonlyArray<number>) =>
      notificationsApi((client) => client.inbox.markRead({ payload: { ids } })),
    onSuccess: invalidate,
    onError,
  }))
  const markAllRead = useMutation(() => ({
    mutationFn: () => notificationsApi((client) => client.inbox.markAllRead()),
    onSuccess: invalidate,
    onError,
  }))

  const open = (item: InboxItem) => {
    if (item.readAt === null) markRead.mutate([item.id])
    const link = item.content.link
    if (link === undefined) return
    if (link.startsWith("/")) void router.history.push(link)
    else window.open(link, "_blank", "noopener,noreferrer")
  }

  return { markRead, markAllRead, open, invalidate }
}

/** The sending app's icon, in its colour unless the notification alarms; Mosaik's own get the bell. */
const SourceIcon = (props: { item: InboxItem }) => {
  const severity = () => {
    const severity = props.item.content.severity
    return severity === "warning" || severity === "critical" ? severity : undefined
  }
  const app = () => sourceApp(props.item.source)
  return (
    <span class={sourceIcon({ severity: severity() })} aria-hidden="true">
      <Show when={app()} fallback={<Bell size={18} />}>
        {(found) => (
          <AppIcon
            name={found().portal.icon}
            size={18}
            color={severity() === undefined ? appColor(found()) : undefined}
          />
        )}
      </Show>
    </span>
  )
}

/**
 * Notifications under the day they came, newest first: each with its app's icon, its title and time, and a line or two of what it says; unread ones bold, with
 * a dot, and a way to mark them read without opening them.
 */
export const NotificationList = (props: {
  items: ReadonlyArray<InboxItem>
  onOpen: (item: InboxItem) => void
  /** Marks one read where it is listed; without it, only opening it does. */
  onMarkRead?: (item: InboxItem) => void
  empty: JSX.Element
  /** How many lines of what it says each shows (1 in the bell's panel). */
  lines?: 1 | 2
  /** Only unread ones are listed (the bell's panel): nothing marks them apart. */
  unreadOnly?: boolean
}) => {
  const now = Date.now()
  const groups = () => groupByDay(props.items, (item) => item.createdAt.epochMilliseconds, now)
  return (
    <Show when={props.items.length > 0} fallback={props.empty}>
      <div class={styles.groups}>
        <For each={groups()}>
          {(group) => (
            <section aria-label={group.day}>
              <h3 class={styles.heading}>{group.day}</h3>
              <ul>
                <For each={group.items}>
                  {(item) => {
                    const unread = () => item.readAt === null
                    // Bold and a dot tell unread ones from the others, where there are others.
                    const marked = () => unread() && props.unreadOnly !== true
                    const what = () => preview(item.content.body)
                    return (
                      <li class={styles.row}>
                        <button type="button" class={styles.item} onClick={() => props.onOpen(item)}>
                          <SourceIcon item={item} />
                          <span class={styles.text}>
                            <span class={styles.line}>
                              <span class={styles.title} data-unread={props.unreadOnly === true ? undefined : unread()}>
                                <Show when={marked()}>
                                  <span class={css({ srOnly: true })}>Unread: </span>
                                </Show>
                                {item.content.title}
                              </span>
                              <time
                                class={styles.time}
                                data-trailing
                                dateTime={new Date(item.createdAt.epochMilliseconds).toISOString()}
                              >
                                {shortAgo(item.createdAt.epochMilliseconds, now)}
                              </time>
                            </span>
                            <span class={styles.preview} data-lines={props.lines ?? 2}>
                              {sourceName(item.source)}
                              <Show when={what()}>{(text) => <> · {text()}</>}</Show>
                            </span>
                          </span>
                          <Show when={marked()}>
                            <span class={styles.unread} data-trailing aria-hidden="true" />
                          </Show>
                        </button>
                        <Show when={unread() && props.onMarkRead}>
                          {(markRead) => (
                            <div class={styles.actions} data-actions>
                              <Tooltip content="Mark as read">
                                {(trigger) => (
                                  <IconButton
                                    {...trigger()}
                                    size="xs"
                                    variant="plain"
                                    aria-label={`Mark "${item.content.title}" as read`}
                                    onClick={() => markRead()(item)}
                                  >
                                    <Check size={14} />
                                  </IconButton>
                                )}
                              </Tooltip>
                            </div>
                          )}
                        </Show>
                      </li>
                    )
                  }}
                </For>
              </ul>
            </section>
          )}
        </For>
      </div>
    </Show>
  )
}
