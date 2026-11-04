import { Heading, IconButton } from "@mosaik/mosaik-ui"
import { css } from "@mosaik/styled-system/css"
import ArrowLeft from "lucide-solid/icons/arrow-left"
import Maximize2 from "lucide-solid/icons/maximize-2"
import Plus from "lucide-solid/icons/plus"
import X from "lucide-solid/icons/x"
import { createSignal, type JSX, Show } from "solid-js"
import type { PageContext } from "../contract"
import { Conversation } from "./Conversation"
import { ConversationHeading } from "./ConversationHeading"
import { ConversationList } from "./ConversationList"
import { panelConversation, setPanelConversation } from "./state"

const styles = {
  panel: css({
    position: "relative",
    display: "flex",
    flexDirection: "column",
    height: "full",
    minHeight: "0",
    bg: "gray.1",
    // Its header overlays its top, as the shell's does a full page's (`FRAME_TOP`): what is below
    // scrolls under it, frosted.
    "--mk-frame-top": "sizes.14",
  }),
  header: css({
    position: "absolute",
    top: "0",
    insetX: "0",
    zIndex: "1",
    display: "flex",
    alignItems: "center",
    gap: "1",
    height: "14",
    px: "3",
    borderBottomWidth: "1px",
    bg: "gray.1/85",
    backdropFilter: "blur(8px)",
  }),
  heading: css({ display: "flex", alignItems: "center", gap: "1", flex: "1", minW: "0" }),
  list: css({ display: "flex", flexDirection: "column", flex: "1", minHeight: "0", pt: "14" }),
}

/**
 * The assistant beside the page: a conversation that knows where the person is, so "this order"
 * means the one on screen. Its conversation is shared with the assistant's own page, and it is
 * built like that page on a phone: the conversation, or the list of them behind "←".
 */
export const AssistantPanel = (props: {
  /** Where the person is, sent with each message. */
  readonly context: () => PageContext
  readonly onClose: () => void
  /** Opens the conversation on the assistant's own page (`null`: a new one). */
  readonly onExpand: (conversation: string | null) => void
}): JSX.Element => {
  const [listing, setListing] = createSignal(false)
  const open = (conversation: string | null) => {
    setPanelConversation(conversation)
    setListing(false)
  }

  return (
    <section class={styles.panel} aria-label="Assistant">
      <header class={styles.header}>
        <Show
          when={!listing()}
          fallback={
            <div class={styles.heading}>
              <Heading textStyle="sm" fontWeight="medium" flex="1" minW="0">
                Conversations
              </Heading>
            </div>
          }
        >
          <div class={styles.heading}>
            <IconButton
              variant="plain"
              size="sm"
              aria-label="Back to the conversations"
              onClick={() => setListing(true)}
            >
              <ArrowLeft size={16} />
            </IconButton>
            <ConversationHeading conversation={panelConversation()} onDeleted={() => open(null)} />
          </div>
          <IconButton variant="plain" size="sm" aria-label="New conversation" onClick={() => open(null)}>
            <Plus size={16} />
          </IconButton>
        </Show>
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
      <Show
        when={!listing()}
        fallback={
          <div class={styles.list}>
            <ConversationList selected={panelConversation()} onSelect={open} />
          </div>
        }
      >
        <Conversation conversation={panelConversation} onStarted={setPanelConversation} context={props.context} />
      </Show>
    </section>
  )
}
