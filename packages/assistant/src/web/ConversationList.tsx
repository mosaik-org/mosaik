import { Button, Spinner, TextField } from "@mosaik/mosaik-ui"
import { css } from "@mosaik/styled-system/css"
import { useQuery } from "@tanstack/solid-query"
import Plus from "lucide-solid/icons/plus"
import Search from "lucide-solid/icons/search"
import { createMemo, createSignal, For, type JSX, Show } from "solid-js"
import { assistant } from "./api"
import { ConversationMenu } from "./ConversationMenu"
import { groupByDate, matchingConversations, titleOrDefault } from "./view"

const styles = {
  root: css({ display: "flex", flexDirection: "column", gap: "3", p: "3", flex: "1", minHeight: "0" }),
  scroller: css({ display: "flex", flexDirection: "column", gap: "4", flex: "1", minHeight: "0", overflowY: "auto" }),
  group: css({ display: "flex", flexDirection: "column", gap: "0.5" }),
  heading: css({
    px: "3",
    pb: "1",
    fontSize: "xs",
    fontWeight: "semibold",
    color: "fg.subtle",
    textTransform: "uppercase",
    letterSpacing: "wider",
  }),
  row: css({
    position: "relative",
    "&:hover > [data-actions], &:focus-within > [data-actions], & > [data-actions]:has([data-state=open])": {
      opacity: "1",
    },
  }),
  item: css({
    display: "block",
    width: "full",
    px: "3",
    py: "2",
    pr: "9",
    borderRadius: "l2",
    textAlign: "start",
    fontSize: "sm",
    color: "fg.muted",
    cursor: "pointer",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    _hover: { bg: "gray.subtle.bg", color: "fg.default" },
    _focusVisible: { outline: "2px solid", outlineColor: "accent.solid.bg", outlineOffset: "-2px" },
    "&[aria-current=true]": { bg: "accent.subtle.bg", color: "accent.plain.fg", fontWeight: "medium" },
  }),
  actions: css({
    position: "absolute",
    top: "50%",
    right: "1.5",
    transform: "translateY(-50%)",
    opacity: "0",
    transition: "opacity 0.15s",
  }),
  empty: css({ px: "3", fontSize: "sm", color: "fg.muted" }),
}

/**
 * The person's conversations, latest first, under when they were last used, with a search by
 * title, a way to start a new one, and each one's actions (rename, delete) on hover.
 */
export const ConversationList = (props: {
  readonly selected: string | null
  readonly onSelect: (conversation: string | null) => void
}): JSX.Element => {
  const conversations = useQuery(() => assistant.assistant.conversations.query())
  const [query, setQuery] = createSignal("")
  const groups = createMemo(() => groupByDate(matchingConversations(conversations.data ?? [], query()), new Date()))

  return (
    <nav class={styles.root} aria-label="Conversations">
      <Button variant="outline" size="sm" onClick={() => props.onSelect(null)}>
        <Plus size={14} /> New conversation
      </Button>
      <TextField
        aria-label="Search conversations"
        type="search"
        size="sm"
        placeholder="Search conversations"
        startElement={<Search size={14} />}
        value={query()}
        onValueChange={setQuery}
      />
      <div class={styles.scroller}>
        <Show when={!conversations.isPending} fallback={<Spinner size="sm" />}>
          <For
            each={groups()}
            fallback={<p class={styles.empty}>{query().trim() === "" ? "No conversations yet." : "None match."}</p>}
          >
            {(group) => (
              <section class={styles.group} aria-label={group.label}>
                <h3 class={styles.heading}>{group.label}</h3>
                <For each={group.conversations}>
                  {(conversation) => (
                    <div class={styles.row}>
                      <button
                        type="button"
                        class={styles.item}
                        aria-current={conversation.id === props.selected}
                        onClick={() => props.onSelect(conversation.id)}
                      >
                        {titleOrDefault(conversation.title)}
                      </button>
                      <div class={styles.actions} data-actions>
                        <ConversationMenu
                          conversation={conversation}
                          onDeleted={() => conversation.id === props.selected && props.onSelect(null)}
                        />
                      </div>
                    </div>
                  )}
                </For>
              </section>
            )}
          </For>
        </Show>
      </div>
    </nav>
  )
}
