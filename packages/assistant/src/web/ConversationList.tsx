import { Button, Spinner, TextField, Tooltip } from "@mosaik/mosaik-ui"
import { css } from "@mosaik/styled-system/css"
import { useQuery } from "@tanstack/solid-query"
import Clock from "lucide-solid/icons/clock"
import Plus from "lucide-solid/icons/plus"
import Search from "lucide-solid/icons/search"
import { createMemo, createSignal, For, type JSX, Show } from "solid-js"
import { assistant } from "./api"
import { ConversationMenu } from "./ConversationMenu"
import { groupByDate, matchingConversations, titleOrDefault } from "./view"

const styles = {
  root: css({ display: "flex", flexDirection: "column", gap: "3", py: "3", flex: "1", minHeight: "0" }),
  controls: css({ display: "flex", flexDirection: "column", gap: "3", px: "3" }),
  // As wide as the column, its padding inside: the scrollbar runs along the column's edge, clear of the rows.
  scroller: css({
    display: "flex",
    flexDirection: "column",
    gap: "4",
    flex: "1",
    minHeight: "0",
    px: "3",
    overflowY: "auto",
  }),
  group: css({ display: "flex", flexDirection: "column", gap: "0.5" }),
  heading: css({
    px: "3",
    pb: "1",
    fontSize: "xs",
    fontWeight: "semibold",
    color: "fg.muted",
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
    display: "flex",
    alignItems: "center",
    gap: "2",
    width: "full",
    px: "3",
    py: "2",
    pr: "9",
    borderRadius: "l2",
    textAlign: "start",
    fontSize: "sm",
    color: "fg.muted",
    cursor: "pointer",
    _focusVisible: { outline: "2px solid", outlineColor: "accent.solid.bg", outlineOffset: "-2px" },
    "&:not([aria-current=true]):hover": { bg: "gray.subtle.bg", color: "fg.default" },
    // Waiting for the person: as dark as the open one, with its clock (the one colour here).
    "&[data-waiting=true]": { color: "fg.default" },
    // The open conversation, waiting or not.
    "&[aria-current=true]": { bg: "gray.subtle.bg.hover", color: "fg.default", fontWeight: "medium" },
  }),
  actions: css({
    position: "absolute",
    top: "50%",
    right: "1.5",
    transform: "translateY(-50%)",
    opacity: "0",
    transition: "opacity 0.15s",
  }),
  title: css({ flex: "1", minW: "0", truncate: true }),
  // It waits for the person: what they came for.
  waiting: css({ display: "flex", flexShrink: "0", color: "accent.plain.fg" }),
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
  // Latest first, under when they were last used; the ones waiting for the person are marked where they are.
  const groups = createMemo(() => groupByDate(matchingConversations(conversations.data ?? [], query()), new Date()))

  return (
    <nav class={styles.root} aria-label="Conversations">
      <div class={styles.controls}>
        <Button variant="outline" size="md" onClick={() => props.onSelect(null)}>
          <Plus size={14} /> New conversation
        </Button>
        <TextField
          aria-label="Search conversations"
          type="search"
          size="md"
          placeholder="Search conversations"
          startElement={<Search size={14} />}
          value={query()}
          onValueChange={setQuery}
        />
      </div>
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
                        data-waiting={conversation.waitingChanges > 0}
                        onClick={() => props.onSelect(conversation.id)}
                      >
                        {/* As the conversation itself says it: "Waiting for your approval", with a clock. */}
                        <Show when={conversation.waitingChanges > 0}>
                          <Tooltip content="Waiting for your approval">
                            <span class={styles.waiting}>
                              <Clock size={14} aria-hidden="true" />
                              <span class={css({ srOnly: true })}>Waiting for your approval:</span>
                            </span>
                          </Tooltip>
                        </Show>
                        <span class={styles.title}>{titleOrDefault(conversation.title)}</span>
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
