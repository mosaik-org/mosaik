import { FRAME_TOP } from "@mosaik/frame"
import { css, cx } from "@mosaik/styled-system/css"
import { useQuery } from "@tanstack/solid-query"
import CircleAlert from "lucide-solid/icons/circle-exclamation-point"
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  type JSX,
  Match,
  on,
  onCleanup,
  onMount,
  Show,
  Switch,
} from "solid-js"
import type { PageContext } from "../contract"
import { ApprovalCard } from "./ApprovalCard"
import { assistant } from "./api"
import { Composer } from "./Composer"
import { createConversation } from "./createConversation"
import { Question, Reply, type TextSize } from "./MessageView"
import { callStatus, conversationItems, liveActivity } from "./view"
import { Welcome } from "./Welcome"

const styles = {
  root: css({ position: "relative", display: "flex", flexDirection: "column", flex: "1", minHeight: "0" }),
  // The messages fill it at least (an empty conversation does not scroll), and start below the
  // frame's header on a full page (`FRAME_TOP`): they scroll under it, frosted.
  scroller: css({ flex: "1", minHeight: "0", display: "flex", flexDirection: "column", overflowY: "auto" }),
  messages: css({ display: "flex", flexDirection: "column", gap: "4", p: "3", flex: "1 0 auto" }),
  /** On the assistant's own page: a column people can read, centered. */
  readable: css({ maxWidth: "3xl", mx: "auto", width: "full", px: { base: "4", md: "6" }, py: "8", gap: "6" }),
  // Over the conversation's end: the messages scroll under the composer, which is translucent. From
  // the box's middle down the page's colour takes over, so the hint under it reads on a plain ground.
  footer: css({
    position: "absolute",
    insetX: "0",
    bottom: "0",
    p: "3",
    pointerEvents: "none",
    bg: "linear-gradient(to bottom, transparent 35%, token(colors.canvas) 62%)",
    "& > *": { pointerEvents: "auto" },
  }),
  footerReadable: css({ maxWidth: "3xl", mx: "auto", width: "full", px: { base: "4", md: "6" }, pb: "4" }),
  live: css({ display: "flex", alignItems: "center", gap: "2", fontSize: "sm", color: "fg.muted" }),
  dots: css({
    display: "inline-flex",
    gap: "1",
    "& > span": {
      width: "1.5",
      height: "1.5",
      borderRadius: "full",
      bg: "fg.subtle",
      animation: "fade-in 0.6s ease-in-out infinite alternate",
    },
    "& > span:nth-child(2)": { animationDelay: "0.2s" },
    "& > span:nth-child(3)": { animationDelay: "0.4s" },
  }),
  hint: css({ fontSize: "xs", color: "fg.muted" }),
  error: css({ display: "flex", gap: "2", alignItems: "flex-start", color: "danger.plain.fg", fontSize: "sm" }),
}

/** That the assistant is at work, and on what when it calls a tool. */
const Working = (props: { readonly label: string }) => (
  <span class={styles.live} role="status">
    <span class={styles.dots} aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
    {props.label}
  </span>
)

/**
 * A conversation with the assistant: the person's questions and the assistant's replies (with
 * their tool activity), the changes waiting for the person, and where they write. Shown in the
 * side panel and on the assistant's page; the frame decides which conversation (`null`: a new
 * one, started by the first message).
 */
export const Conversation = (props: {
  readonly conversation: () => string | null
  /** A new conversation was started by the first message. */
  readonly onStarted: (conversation: string) => void
  /** Where the person is, sent with each message; `null` where no other page is in view. */
  readonly context: () => PageContext | null
  /** On the assistant's own page: a centered, wider column with larger text. */
  readonly readable?: boolean
}): JSX.Element => {
  const model = createConversation({
    conversation: props.conversation,
    onStarted: props.onStarted,
    context: props.context,
  })
  const { state } = model
  const [text, setText] = createSignal("")
  const status = useQuery(() => assistant.assistant.status.query())
  const enabled = () => status.data?.enabled !== false
  const size = (): TextSize => (props.readable === true ? "md" : "sm")
  // The composer's height, as it grows with what is written: the conversation leaves that much room.
  let footer: HTMLDivElement | undefined
  const [composerHeight, setComposerHeight] = createSignal(0)
  onMount(() => {
    if (footer === undefined) return
    const observer = new ResizeObserver(() => setComposerHeight(footer?.offsetHeight ?? 0))
    observer.observe(footer)
    onCleanup(() => observer.disconnect())
  })
  let scroller: HTMLDivElement | undefined

  const items = createMemo(() => conversationItems(state.messages))
  const statusOf = (call: Parameters<typeof callStatus>[0]) => callStatus(call, model.results(), model.pendingIds())
  const changesWaiting = () => state.pending.filter((call) => call.changes)
  // The reply in progress: the last item if it is one, else one to come after the person's question.
  const replyInProgress = () => state.busy || changesWaiting().length > 0 || state.error !== null
  const lastIsReply = () => items().at(-1)?.kind === "reply"

  createEffect(
    on([() => state.messages.length, () => state.draft, () => state.pending.length], () =>
      queueMicrotask(() => scroller?.scrollTo({ top: scroller.scrollHeight })),
    ),
  )

  const send = (message: string) => {
    setText("")
    void model.send(message)
  }

  /** What follows the reply: the assistant at work, the changes waiting, what went wrong. */
  const tail = () => (
    <>
      <Show when={state.busy && state.draft === ""}>
        <Working label={liveActivity(state.messages, model.results()) ?? "Thinking…"} />
      </Show>
      <For each={changesWaiting()}>
        {(call) => (
          <ApprovalCard call={call} busy={state.busy} onDecide={(approve) => void model.decide(call, approve)} />
        )}
      </For>
      <Show when={state.error}>
        {(error) => (
          <div class={styles.error} role="alert">
            <CircleAlert size={16} />
            <span>{error()}</span>
          </div>
        )}
      </Show>
    </>
  )

  return (
    <div class={styles.root}>
      <div
        class={styles.scroller}
        ref={scroller}
        // Room at the end for the composer over it, so the last message scrolls clear of it.
        style={{ "padding-top": FRAME_TOP, "padding-bottom": `${composerHeight()}px` }}
      >
        <div class={cx(styles.messages, props.readable === true && styles.readable)}>
          <Show when={items().length > 0 || state.busy} fallback={<Welcome enabled={enabled()} onPick={send} />}>
            <For each={items()}>
              {(item, index) => (
                <Switch>
                  <Match when={item.kind === "question" && item}>
                    {(question) => <Question message={question().message} size={size()} />}
                  </Match>
                  <Match when={item.kind === "reply" && item}>
                    {(reply) => {
                      const isLast = () => index() === items().length - 1
                      return (
                        <Reply
                          messages={reply().messages}
                          draft={isLast() ? state.draft : ""}
                          complete={!(isLast() && state.busy)}
                          statusOf={statusOf}
                          size={size()}
                          onNavigate={model.navigate}
                        >
                          <Show when={isLast() && replyInProgress()}>{tail()}</Show>
                        </Reply>
                      )
                    }}
                  </Match>
                </Switch>
              )}
            </For>
            <Show when={!lastIsReply() && replyInProgress()}>
              <Reply
                messages={[]}
                draft={state.draft}
                complete={false}
                statusOf={statusOf}
                size={size()}
                onNavigate={model.navigate}
              >
                {tail()}
              </Reply>
            </Show>
            {/* A turn that failed or stopped earlier stored the question but no answer. */}
            <Show when={!replyInProgress() && items().at(-1)?.kind === "question"}>
              <span class={styles.hint}>No reply to this message. Send it again to retry.</span>
            </Show>
          </Show>
        </div>
      </div>

      <div ref={footer} class={cx(styles.footer, props.readable === true && styles.footerReadable)}>
        <Composer
          value={text()}
          onInput={setText}
          onSend={() => send(text())}
          onStop={model.stop}
          busy={state.busy}
          disabled={!enabled()}
          note={changesWaiting().length > 0 ? "Writing again skips the changes waiting above." : undefined}
        />
      </div>
    </div>
  )
}
