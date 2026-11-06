import { IconButton } from "@mosaik/mosaik-ui"
import { css, cx } from "@mosaik/styled-system/css"
import ArrowUp from "lucide-solid/icons/arrow-up"
import Square from "lucide-solid/icons/square"
import { createEffect, type JSX, on, Show } from "solid-js"

const styles = {
  root: css({ display: "flex", flexDirection: "column", gap: "1.5", width: "full" }),
  box: css({
    display: "flex",
    alignItems: "flex-end",
    gap: "2",
    p: "2",
    pl: "3.5",
    borderWidth: "1px",
    borderRadius: "l3",
    // Translucent: what scrolls under it shows through, blurred.
    bg: "gray.surface.bg/75",
    backdropFilter: "blur(16px) saturate(1.5)",
    boxShadow: "xs",
    transition: "border-color 0.15s, box-shadow 0.15s",
    _focusWithin: { borderColor: "accent.solid.bg", boxShadow: "0 0 0 1px token(colors.accent.solid.bg)" },
  }),
  input: css({
    flex: "1",
    minWidth: "0",
    py: "1.5",
    border: "none",
    outline: "none",
    bg: "transparent",
    color: "fg.default",
    fontSize: "sm",
    lineHeight: "1.5",
    resize: "none",
    // Grows with what is written, up to about eight lines, then scrolls.
    maxHeight: "12rem",
    overflowY: "auto",
    _placeholder: { color: "fg.muted" },
    _disabled: { cursor: "not-allowed" },
  }),
  send: css({ borderRadius: "full", flexShrink: "0" }),
  hints: css({
    px: "1",
    fontSize: "xs",
    color: "fg.muted",
  }),
  // Above the box, over the conversation: a frosted background of its own keeps it readable.
  note: css({
    alignSelf: "start",
    px: "2",
    py: "0.5",
    borderRadius: "l2",
    fontSize: "xs",
    color: "fg.muted",
    bg: "canvas/85",
    backdropFilter: "blur(8px)",
  }),
}

/**
 * Where the person writes: one rounded box whose text grows with what is written, sent with
 * Enter (Shift+Enter for a new line) or the round button, which stops the reply while one is
 * being written.
 */
export const Composer = (props: {
  readonly value: string
  readonly onInput: (value: string) => void
  readonly onSend: () => void
  readonly onStop: () => void
  readonly busy: boolean
  readonly disabled: boolean
  /** A note above the box, e.g. that writing again skips the changes waiting. */
  readonly note?: string | undefined
  readonly class?: string
}): JSX.Element => {
  let input: HTMLTextAreaElement | undefined
  // Fits the box to the text: shrinks first, so deleting lines shrinks it too.
  const fit = () => {
    if (input === undefined) return
    // Empty, it keeps its one row (measuring it before it is laid out would collapse it).
    if (props.value === "") return input.style.removeProperty("height")
    input.style.height = "auto"
    input.style.height = `${input.scrollHeight}px`
  }
  createEffect(
    on(
      () => props.value,
      () => queueMicrotask(fit),
    ),
  )

  return (
    <form
      class={cx(styles.root, props.class)}
      onSubmit={(event) => {
        event.preventDefault()
        if (props.busy) props.onStop()
        else props.onSend()
      }}
    >
      <Show when={props.note}>{(note) => <span class={styles.note}>{note()}</span>}</Show>
      <div class={styles.box}>
        <textarea
          ref={input}
          class={styles.input}
          aria-label="Message"
          placeholder="Ask the assistant…"
          rows={1}
          value={props.value}
          disabled={props.disabled}
          onInput={(event) => props.onInput(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
              event.preventDefault()
              if (!props.busy) props.onSend()
            }
          }}
        />
        <Show
          when={props.busy}
          fallback={
            <IconButton
              type="submit"
              size="sm"
              class={styles.send}
              aria-label="Send"
              disabled={props.disabled || props.value.trim() === ""}
            >
              <ArrowUp size={16} />
            </IconButton>
          }
        >
          <IconButton type="submit" size="sm" variant="outline" class={styles.send} aria-label="Stop">
            <Square size={12} fill="currentColor" />
          </IconButton>
        </Show>
      </div>
      <span class={styles.hints}>Enter to send · Shift+Enter for a new line</span>
    </form>
  )
}
