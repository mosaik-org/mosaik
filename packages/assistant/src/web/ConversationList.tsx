import { formatRelativeTime } from "@mosaik/client"
import { Button, Spinner } from "@mosaik/mosaik-ui"
import { css } from "@mosaik/styled-system/css"
import { useQuery } from "@tanstack/solid-query"
import Plus from "lucide-solid/icons/plus"
import { For, type JSX, Show } from "solid-js"
import { assistant } from "./api"

const styles = {
  root: css({
    display: "flex",
    flexDirection: "column",
    gap: "2",
    p: "3",
    flex: "1",
    minHeight: "0",
    overflowY: "auto",
  }),
  item: css({
    display: "flex",
    flexDirection: "column",
    gap: "0.5",
    width: "full",
    px: "3",
    py: "2",
    borderRadius: "l2",
    textAlign: "start",
    cursor: "pointer",
    _hover: { bg: "gray.subtle.bg" },
    _focusVisible: { outline: "2px solid", outlineColor: "accent.solid.bg" },
    "&[aria-current=true]": { bg: "accent.subtle.bg", color: "accent.subtle.fg" },
  }),
  title: css({
    fontSize: "sm",
    fontWeight: "medium",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  }),
  when: css({ fontSize: "xs", color: "fg.muted" }),
}

/** The person's conversations, latest first, and a way to start a new one. */
export const ConversationList = (props: {
  readonly selected: string | null
  readonly onSelect: (conversation: string | null) => void
}): JSX.Element => {
  const conversations = useQuery(() => assistant.assistant.conversations.query())
  return (
    <nav class={styles.root} aria-label="Conversations">
      <Button variant="outline" size="sm" onClick={() => props.onSelect(null)}>
        <Plus size={14} /> New conversation
      </Button>
      <Show when={!conversations.isPending} fallback={<Spinner size="sm" />}>
        <For each={conversations.data ?? []} fallback={<p class={styles.when}>No conversations yet.</p>}>
          {(conversation) => (
            <button
              type="button"
              class={styles.item}
              aria-current={conversation.id === props.selected}
              onClick={() => props.onSelect(conversation.id)}
            >
              <span class={styles.title}>{conversation.title === "" ? "Untitled" : conversation.title}</span>
              <span class={styles.when}>{formatRelativeTime(conversation.updatedAt.epochMilliseconds)}</span>
            </button>
          )}
        </For>
      </Show>
    </nav>
  )
}
