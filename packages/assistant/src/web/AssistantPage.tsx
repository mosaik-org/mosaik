import { css, cx } from "@mosaik/styled-system/css"
import { FRAME_TOP, FrameHeader } from "@mosaik/web-kit"
import { useQuery } from "@tanstack/solid-query"
import ArrowLeft from "lucide-solid/icons/arrow-left"
import { type JSX, Show } from "solid-js"
import { assistant } from "./api"
import { Conversation } from "./Conversation"
import { ConversationList } from "./ConversationList"
import { ConversationMenu } from "./ConversationMenu"
import { titleOrDefault } from "./view"

const styles = {
  page: css({
    display: "grid",
    gridTemplateColumns: { base: "1fr", md: "280px 1fr" },
    flex: "1",
    minHeight: "0",
    // The page fills the window under the shell's header, which overlays its top (the `full`
    // layout); its columns scroll inside, under the header, the page never does.
    overflow: "hidden",
  }),
  list: css({
    display: "flex",
    flexDirection: "column",
    minHeight: "0",
    overflow: "hidden",
    borderRightWidth: { md: "1px" },
    bg: "gray.1",
  }),
  main: css({ display: "flex", flexDirection: "column", minHeight: "0", minWidth: "0" }),
  back: css({
    display: "inline-flex",
    alignItems: "center",
    flexShrink: "0",
    gap: "1",
    fontSize: "sm",
    whiteSpace: "nowrap",
    color: "fg.muted",
    cursor: "pointer",
    _hover: { color: "fg.default" },
  }),
  // On phones the arrow alone, so the title keeps the room (the button's label says where it goes).
  backLabel: css({ hideBelow: "sm" }),
  title: css({ minW: "0", fontSize: "sm", fontWeight: "medium", truncate: true }),
}

/**
 * The assistant on a page of its own, for conversations that are the work itself: the person's
 * conversations beside the one open, in a column wide enough for tables. It is about no other
 * page, so its messages carry none.
 */
export const AssistantPage = (props: {
  readonly conversation: string | null
  readonly onSelect: (conversation: string | null) => void
  /** Back to the page the person came from, with the conversation beside it; absent when they came straight here. */
  readonly onBack?: (() => void) | undefined
}): JSX.Element => {
  const conversations = useQuery(() => assistant.assistant.conversations.query())
  const open = () => conversations.data?.find((each) => each.id === props.conversation)

  return (
    <div class={styles.page}>
      {/* In the shell's top bar: the way back, which conversation this is, and what can be done with it. */}
      <FrameHeader>
        {/* On phones the list is hidden while a conversation is open: the way back to it. */}
        <Show when={props.conversation !== null}>
          <button
            type="button"
            class={cx(styles.back, css({ hideFrom: "md" }))}
            aria-label="Back to the conversations"
            onClick={() => props.onSelect(null)}
          >
            <ArrowLeft size={14} /> <span class={styles.backLabel}>Conversations</span>
          </button>
        </Show>
        <Show when={props.onBack}>
          {(back) => (
            <button type="button" class={styles.back} aria-label="Back to the page" onClick={() => back()()}>
              <ArrowLeft size={14} /> <span class={styles.backLabel}>Back to the page</span>
            </button>
          )}
        </Show>
        <span class={styles.title}>
          {props.conversation === null ? "New conversation" : titleOrDefault(open()?.title ?? "")}
        </span>
        <Show when={open()}>
          {(conversation) => <ConversationMenu conversation={conversation()} onDeleted={() => props.onSelect(null)} />}
        </Show>
      </FrameHeader>
      {/* On phones: the list until a conversation is open. */}
      {/* Starts below the frame's header, which overlays the page's top (`FRAME_TOP`). */}
      <div
        class={styles.list}
        classList={{ [css({ hideBelow: "md" })]: props.conversation !== null }}
        style={{ "padding-top": FRAME_TOP }}
      >
        <ConversationList selected={props.conversation} onSelect={props.onSelect} />
      </div>
      <section
        class={styles.main}
        classList={{ [css({ hideBelow: "md" })]: props.conversation === null }}
        aria-label="Assistant"
      >
        <Conversation
          conversation={() => props.conversation}
          onStarted={(id) => props.onSelect(id)}
          context={() => null}
          readable
        />
      </section>
    </div>
  )
}
