import { css } from "@mosaik/styled-system/css"
import { useQuery } from "@tanstack/solid-query"
import { type JSX, Show } from "solid-js"
import { assistant } from "./api"
import { ConversationMenu } from "./ConversationMenu"
import { titleOrDefault } from "./view"

const styles = {
  title: css({ minW: "0", fontSize: "sm", fontWeight: "medium", truncate: true }),
}

/**
 * Which conversation is open and what can be done with it (rename, pin, delete): the same in the
 * shell's top bar on the assistant's page and at the top of the side panel.
 */
export const ConversationHeading = (props: {
  /** `null`: a new one, not started yet. */
  readonly conversation: string | null
  readonly onDeleted: () => void
}): JSX.Element => {
  const conversations = useQuery(() => assistant.assistant.conversations.query())
  const open = () => conversations.data?.find((each) => each.id === props.conversation)
  return (
    <>
      <span class={styles.title}>
        {props.conversation === null ? "New conversation" : titleOrDefault(open()?.title ?? "")}
      </span>
      <Show when={open()}>
        {(conversation) => <ConversationMenu conversation={conversation()} onDeleted={props.onDeleted} />}
      </Show>
    </>
  )
}
