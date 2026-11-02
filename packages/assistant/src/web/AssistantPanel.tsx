import { IconButton } from "@mosaik/mosaik-ui"
import { css } from "@mosaik/styled-system/css"
import { useQuery } from "@tanstack/solid-query"
import Maximize2 from "lucide-solid/icons/maximize-2"
import Plus from "lucide-solid/icons/plus"
import X from "lucide-solid/icons/x"
import { For, type JSX } from "solid-js"
import type { PageContext } from "../contract"
import { assistant } from "./api"
import { Conversation } from "./Conversation"
import { panelConversation, setPanelConversation } from "./state"

const styles = {
  panel: css({ display: "flex", flexDirection: "column", height: "full", minHeight: "0", bg: "gray.1" }),
  header: css({
    display: "flex",
    alignItems: "center",
    gap: "1",
    height: "14",
    px: "3",
    borderBottomWidth: "1px",
    flexShrink: "0",
  }),
  picker: css({
    flex: "1",
    minWidth: "0",
    h: "8",
    px: "2",
    borderRadius: "l2",
    borderWidth: "1px",
    bg: "gray.surface.bg",
    fontSize: "sm",
    textOverflow: "ellipsis",
  }),
}

/**
 * The assistant beside the page: a conversation that knows where the person is, so "this order"
 * means the one on screen. Its conversation is shared with the assistant's own page.
 */
export const AssistantPanel = (props: {
  /** Where the person is, sent with each message. */
  readonly context: () => PageContext
  readonly onClose: () => void
  /** Opens the conversation on the assistant's own page (`null`: a new one). */
  readonly onExpand: (conversation: string | null) => void
}): JSX.Element => {
  const conversations = useQuery(() => assistant.assistant.conversations.query())
  return (
    <section class={styles.panel} aria-label="Assistant">
      <header class={styles.header}>
        <select
          class={styles.picker}
          aria-label="Conversation"
          onChange={(event) =>
            setPanelConversation(event.currentTarget.value === "" ? null : event.currentTarget.value)
          }
        >
          {/* Marked on the options: a new conversation's option appears only once the list reloads. */}
          <option value="" selected={panelConversation() === null}>
            New conversation
          </option>
          <For each={conversations.data ?? []}>
            {(each) => (
              <option value={each.id} selected={each.id === panelConversation()}>
                {each.title === "" ? "Untitled" : each.title}
              </option>
            )}
          </For>
        </select>
        <IconButton variant="plain" size="sm" aria-label="New conversation" onClick={() => setPanelConversation(null)}>
          <Plus size={16} />
        </IconButton>
        <IconButton
          variant="plain"
          size="sm"
          aria-label="Open in full view"
          onClick={() => props.onExpand(panelConversation())}
        >
          <Maximize2 size={16} />
        </IconButton>
        <IconButton variant="plain" size="sm" aria-label="Close the assistant" onClick={() => props.onClose()}>
          <X size={16} />
        </IconButton>
      </header>
      <Conversation conversation={panelConversation} onStarted={setPanelConversation} context={props.context} />
    </section>
  )
}
