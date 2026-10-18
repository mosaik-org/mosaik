import { errorMessage, formatRelativeTime } from "@mosaik/client"
import type { InboxItem, Severity } from "@mosaik/notifications/contract"
import { css, cva } from "@mosaik/styled-system/css"
import { toast } from "@mosaik/ui"
import { useMutation, useQueryClient } from "@tanstack/solid-query"
import { useRouter } from "@tanstack/solid-router"
import { For, type JSX, Show } from "solid-js"
import { sourceName } from "../apps"
import { notificationKeys, notificationsApi } from "./api"

const dot = cva({
  base: { flexShrink: "0", boxSize: "2", mt: "1.5", borderRadius: "full" },
  variants: {
    severity: {
      info: { bg: "accent.default" },
      success: { bg: "success.default" },
      warning: { bg: "warning.default" },
      critical: { bg: "danger.default" },
    },
    read: { true: { opacity: "0.25" } },
  },
})

const styles = {
  item: css({
    display: "flex",
    gap: "3",
    w: "full",
    px: "4",
    py: "3",
    textAlign: "start",
    cursor: "pointer",
    borderBottomWidth: "1px",
    borderColor: "border.default",
    _last: { borderBottomWidth: "0" },
    _hover: { bg: "bg.muted" },
    _focusVisible: { outline: "2px solid", outlineColor: "accent.default", outlineOffset: "-2px" },
  }),
  text: css({ display: "flex", flexDirection: "column", gap: "0.5", minW: "0", flex: "1" }),
  title: css({ fontSize: "sm", lineHeight: "snug", "&[data-read=false]": { fontWeight: "semibold" } }),
  body: css({ fontSize: "sm", color: "fg.muted", lineClamp: "2" }),
  meta: css({ fontSize: "xs", color: "fg.subtle" }),
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

export const NotificationList = (props: {
  items: ReadonlyArray<InboxItem>
  onOpen: (item: InboxItem) => void
  empty: JSX.Element
}) => (
  <Show when={props.items.length > 0} fallback={props.empty}>
    <ul class={css({ display: "flex", flexDirection: "column" })}>
      <For each={props.items}>
        {(item) => (
          <li>
            <button type="button" class={styles.item} onClick={() => props.onOpen(item)}>
              <span
                class={dot({ severity: item.content.severity ?? "info", read: item.readAt !== null })}
                aria-hidden="true"
              />
              <span class={styles.text}>
                <span class={styles.title} data-read={item.readAt !== null}>
                  <Show when={item.readAt === null}>
                    <span class={css({ srOnly: true })}>Unread: </span>
                  </Show>
                  {item.content.title}
                </span>
                <Show when={preview(item.content.body)}>{(text) => <span class={styles.body}>{text()}</span>}</Show>
                <span class={styles.meta}>
                  {sourceName(item.source)} · {formatRelativeTime(item.createdAt)}
                </span>
              </span>
            </button>
          </li>
        )}
      </For>
    </ul>
  </Show>
)
