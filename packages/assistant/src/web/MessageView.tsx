import { formatDateTime } from "@mosaik/client"
import { css, cx } from "@mosaik/styled-system/css"
import { IconButton, Tooltip } from "@mosaik/ui"
import Check from "lucide-solid/icons/check"
import Copy from "lucide-solid/icons/copy"
import { createMemo, createSignal, Index, type JSX, Match, Show, Switch } from "solid-js"
import { Portal } from "solid-js/web"
import type { Message, ToolCallPart } from "../contract"
import { ActivityGroup } from "./ActivityGroup"
import { Markdown } from "./Markdown"
import { type CallStatus, replyParts, textOf } from "./view"

const time = new Intl.DateTimeFormat(undefined, { timeStyle: "short" })

const styles = {
  // What the person wrote: grey, as the rest of the page; the accent stays for what acts.
  user: css({
    alignSelf: "flex-end",
    maxWidth: "85%",
    px: "3.5",
    py: "2",
    borderRadius: "l3",
    borderBottomRightRadius: "l1",
    bg: "gray.subtle",
    color: "fg",
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
  }),
  reply: css({ display: "flex", flexDirection: "column", gap: "2", minWidth: "0" }),
  // Shown when the reply is hovered or focused: the time, and copying it.
  actions: css({
    display: "flex",
    alignItems: "center",
    gap: "1",
    minHeight: "6",
    fontSize: "xs",
    color: "fg.muted",
    opacity: "0",
    transition: "opacity 0.15s",
    "[data-reply]:hover &, [data-reply]:focus-within &": { opacity: "1" },
  }),
}

/** What people read at: smaller in the panel, larger on the assistant's own page. */
export type TextSize = "sm" | "md"

export const Question = (props: { readonly message: Message; readonly size: TextSize }): JSX.Element => (
  <div class={cx(styles.user, props.size === "md" ? css({ fontSize: "md" }) : css({ fontSize: "sm" }))}>
    {textOf(props.message)}
  </div>
)

const CopyButton = (props: { readonly text: string }) => {
  const [copied, setCopied] = createSignal(false)
  const copy = async () => {
    await navigator.clipboard.writeText(props.text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <IconButton
      variant="ghost"
      size="xs"
      aria-label={copied() ? "Copied" : "Copy the reply"}
      onClick={() => void copy()}
    >
      <Show when={copied()} fallback={<Copy size={13} />}>
        <Check size={13} />
      </Show>
    </IconButton>
  )
}

/**
 * A reply of the assistant: what it wrote until the person wrote again, in order,
 * its tool calls in a row as one line of activity, then the text still being written. The time and
 * copying show on hover, once it is written.
 */
export const Reply = (props: {
  readonly messages: ReadonlyArray<Message>
  /** The text being written, while the reply streams. */
  readonly draft: string
  /** Whether the reply is complete: its time and copying show. */
  readonly complete: boolean
  readonly statusOf: (call: ToolCallPart) => CallStatus
  readonly size: TextSize
  readonly onNavigate: (path: string) => void
  /** Below the reply: what the assistant is doing, what waits for the person. */
  readonly children?: JSX.Element
}): JSX.Element => {
  const text = () =>
    props.messages
      .map(textOf)
      .filter((each) => each !== "")
      .join("\n\n")
  const last = () => props.messages.at(-1)
  const parts = createMemo(() => replyParts(props.messages))
  return (
    <div class={styles.reply} data-reply>
      {/* By position: parts only grow at the end, so an open activity stays open as the reply goes on. */}
      <Index each={parts()}>
        {(part) => (
          <Switch>
            <Match when={part().kind === "text" && (part() as { text: string })}>
              {(text) => <Markdown text={text().text} size={props.size} onNavigate={props.onNavigate} />}
            </Match>
            <Match when={part().kind === "activity" && (part() as { calls: ReadonlyArray<ToolCallPart> })}>
              {(activity) => <ActivityGroup calls={activity().calls} statuses={activity().calls.map(props.statusOf)} />}
            </Match>
          </Switch>
        )}
      </Index>
      <Show when={props.draft !== ""}>
        <Markdown text={props.draft} size={props.size} onNavigate={props.onNavigate} />
      </Show>
      {props.children}
      <Show when={props.complete && last()}>
        {(message) => (
          <div class={styles.actions}>
            <Tooltip.Root>
              <Tooltip.Trigger
                asChild={(trigger) => (
                  <time dateTime={new Date(message().createdAt.epochMilliseconds).toISOString()} {...trigger()}>
                    {time.format(message().createdAt.epochMilliseconds)}
                  </time>
                )}
              />
              <Portal>
                <Tooltip.Positioner>
                  <Tooltip.Content>{formatDateTime(message().createdAt.epochMilliseconds)}</Tooltip.Content>
                </Tooltip.Positioner>
              </Portal>
            </Tooltip.Root>
            <Show when={text() !== ""}>
              <CopyButton text={text()} />
            </Show>
          </div>
        )}
      </Show>
    </div>
  )
}
