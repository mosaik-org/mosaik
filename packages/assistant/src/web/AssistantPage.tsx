import { css, cx } from "@mosaik/styled-system/css"
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
    // The page fills what the shell leaves below its header (the `full` layout); its columns
    // scroll inside, the page never does.
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
  bar: css({
    display: "flex",
    alignItems: "center",
    gap: "3",
    height: "12",
    px: { base: "4", md: "6" },
    borderBottomWidth: "1px",
    flexShrink: "0",
    fontSize: "sm",
  }),
  back: css({
    display: "inline-flex",
    alignItems: "center",
    gap: "1",
    color: "fg.muted",
    cursor: "pointer",
    _hover: { color: "fg.default" },
  }),
  title: css({ fontWeight: "medium", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }),
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
      {/* On phones: the list until a conversation is open. */}
      <div class={styles.list} classList={{ [css({ hideBelow: "md" })]: props.conversation !== null }}>
        <ConversationList selected={props.conversation} onSelect={props.onSelect} />
      </div>
      <section
        class={styles.main}
        classList={{ [css({ hideBelow: "md" })]: props.conversation === null }}
        aria-label="Assistant"
      >
        <div class={styles.bar}>
          {/* On phones the list is hidden while a conversation is open: the way back to it. */}
          <Show when={props.conversation !== null}>
            <button type="button" class={cx(styles.back, css({ hideFrom: "md" }))} onClick={() => props.onSelect(null)}>
              <ArrowLeft size={14} /> Conversations
            </button>
          </Show>
          <Show when={props.onBack}>
            {(back) => (
              <button type="button" class={styles.back} onClick={() => back()()}>
                <ArrowLeft size={14} /> Back to the page
              </button>
            )}
          </Show>
          <span class={styles.title}>
            {props.conversation === null ? "New conversation" : titleOrDefault(open()?.title ?? "")}
          </span>
          <Show when={open()}>
            {(conversation) => (
              <span class={css({ ml: "auto" })}>
                <ConversationMenu conversation={conversation()} onDeleted={() => props.onSelect(null)} />
              </span>
            )}
          </Show>
        </div>
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
