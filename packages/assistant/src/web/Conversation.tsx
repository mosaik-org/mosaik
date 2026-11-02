import { errorMessage } from "@mosaik/client"
import { Badge, Button, Spinner, Textarea } from "@mosaik/mosaik-ui"
import { css, cx } from "@mosaik/styled-system/css"
import { useQuery, useQueryClient } from "@tanstack/solid-query"
import Check from "lucide-solid/icons/check"
import CircleAlert from "lucide-solid/icons/circle-alert"
import Send from "lucide-solid/icons/send"
import Wrench from "lucide-solid/icons/wrench"
import { createEffect, createMemo, createSignal, For, type JSX, on, Show } from "solid-js"
import { createStore, produce } from "solid-js/store"
import type { Message, PageContext, ToolCallPart, ToolResultPart, TurnEvent } from "../contract"
import { assistant, decide, sendMessage, startConversation } from "./api"
import { inputFields } from "./format"
import { Markdown } from "./Markdown"

const styles = {
  root: css({ display: "flex", flexDirection: "column", flex: "1", minHeight: "0" }),
  scroller: css({ flex: "1", overflowY: "auto" }),
  messages: css({ display: "flex", flexDirection: "column", gap: "3", p: "3", minHeight: "full" }),
  /** On the assistant's own page: a column people can read, centered. */
  readable: css({ maxWidth: "3xl", mx: "auto", width: "full", px: { base: "4", md: "6" }, py: "6", gap: "4" }),
  user: css({
    alignSelf: "flex-end",
    maxWidth: "85%",
    px: "3",
    py: "2",
    borderRadius: "l3",
    bg: "accent.subtle.bg",
    color: "accent.subtle.fg",
    fontSize: "sm",
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
  }),
  reply: css({ display: "flex", flexDirection: "column", gap: "2" }),
  call: css({ display: "flex", alignItems: "center", gap: "1.5", fontSize: "xs", color: "fg.muted" }),
  approval: css({
    display: "flex",
    flexDirection: "column",
    gap: "2",
    p: "3",
    borderWidth: "1px",
    borderRadius: "l3",
    bg: "gray.surface.bg",
  }),
  inputs: css({
    display: "grid",
    gridTemplateColumns: "auto 1fr",
    columnGap: "3",
    rowGap: "1",
    m: "0",
    fontSize: "xs",
    maxHeight: "40",
    overflowY: "auto",
    "& dt": { color: "fg.muted" },
    "& dd": { m: "0", overflowWrap: "anywhere", whiteSpace: "pre-wrap" },
  }),
  composer: css({ display: "flex", flexDirection: "column", gap: "2", p: "3", borderTopWidth: "1px", flexShrink: "0" }),
  composerReadable: css({ maxWidth: "3xl", mx: "auto", width: "full", px: { base: "4", md: "6" } }),
  empty: css({ m: "auto", textAlign: "center", color: "fg.muted", fontSize: "sm", maxWidth: "72" }),
  error: css({ display: "flex", gap: "2", color: "fg.error", fontSize: "sm" }),
  hint: css({ fontSize: "xs", color: "fg.muted" }),
}

/** A call's state, from the results stored after it. */
const callState = (call: ToolCallPart, results: ReadonlyMap<string, ToolResultPart>, pending: ReadonlySet<string>) => {
  const result = results.get(call.id)
  if (result === undefined) return pending.has(call.id) ? "Waiting for you" : "Running…"
  if (result.decision === "denied") return "Not allowed"
  return result.ok ? "Done" : `Failed: ${result.text.slice(0, 200)}`
}

const ApprovalCard = (props: {
  readonly call: ToolCallPart
  readonly busy: boolean
  readonly onDecide: (approve: boolean) => void
}) => (
  <div class={styles.approval}>
    <div class={css({ display: "flex", alignItems: "center", gap: "2", flexWrap: "wrap" })}>
      <strong class={css({ fontSize: "sm" })}>{props.call.title}</strong>
      <Badge size="sm">{props.call.app}</Badge>
      <Show when={props.call.destructive}>
        <Badge size="sm" colorPalette="red">
          Cannot be undone
        </Badge>
      </Show>
    </div>
    <dl class={styles.inputs}>
      <For each={inputFields(props.call.input)}>
        {([name, value]) => (
          <>
            <dt>{name}</dt>
            <dd>{value}</dd>
          </>
        )}
      </For>
    </dl>
    <div class={css({ display: "flex", gap: "2" })}>
      <Button size="sm" loading={props.busy} onClick={() => props.onDecide(true)}>
        <Check size={14} /> Allow
      </Button>
      <Button size="sm" variant="outline" disabled={props.busy} onClick={() => props.onDecide(false)}>
        Deny
      </Button>
    </div>
  </div>
)

/**
 * A conversation with the assistant: its messages, the reply being written, the changes waiting
 * for the person, and where they write. Shown in the side panel and on the assistant's page; the
 * frame decides which conversation (`null`: a new one, started by the first message).
 */
export const Conversation = (props: {
  readonly conversation: () => string | null
  /** A new conversation was started by the first message. */
  readonly onStarted: (conversation: string) => void
  /** Where the person is, sent with each message; `null` where no other page is in view. */
  readonly context: () => PageContext | null
  /** On the assistant's own page: a centered, wider column. */
  readonly readable?: boolean
}): JSX.Element => {
  const queryClient = useQueryClient()
  const [text, setText] = createSignal("")
  const [state, setState] = createStore({
    messages: [] as Array<Message>,
    pending: [] as Array<ToolCallPart>,
    /** The reply being written, until it is stored. */
    draft: "",
    busy: false,
    error: null as string | null,
  })
  // The conversation the first message just started: already shown, so not reset when it is chosen.
  let started: string | null = null
  let scroller: HTMLDivElement | undefined

  const status = useQuery(() => assistant.assistant.status.query())
  const conversation = useQuery(() => ({
    ...assistant.assistant.conversation.query({ params: { id: props.conversation() ?? "" } }),
    enabled: props.conversation() !== null,
  }))

  // Another conversation starts from nothing, until it loads.
  createEffect(
    on(props.conversation, (id) => {
      if (id !== null && id === started) return
      started = null
      setState({ messages: [], pending: [], draft: "", error: null })
    }),
  )
  // A loaded conversation replaces what is shown, except while a turn adds to it.
  createEffect(
    on(
      () => conversation.data,
      (data) => {
        if (data === undefined || state.busy || data.id !== props.conversation()) return
        // Not the error: a failed turn reloads the conversation, and its error must stay in view.
        setState({ messages: [...data.messages], pending: [...data.pending] })
      },
    ),
  )
  createEffect(
    on([() => state.messages.length, () => state.draft, () => state.pending.length], () =>
      queueMicrotask(() => scroller?.scrollTo({ top: scroller.scrollHeight })),
    ),
  )

  const results = createMemo(
    () =>
      new Map(
        state.messages.flatMap((message) =>
          message.parts.flatMap((part) => (part.type === "tool-result" ? [[part.id, part] as const] : [])),
        ),
      ),
  )
  const pendingIds = createMemo(() => new Set(state.pending.map((call) => call.id)))

  const onEvent = (event: TurnEvent) => {
    switch (event.type) {
      case "text":
        return setState("draft", (draft) => draft + event.text)
      case "message":
        return setState(
          produce((draft) => {
            draft.messages.push(event.message)
            if (event.message.role === "assistant") draft.draft = ""
          }),
        )
      case "approval":
        return setState("pending", [...event.calls])
      case "done":
        return
      case "failed":
        return setState("error", event.message)
    }
  }

  /** Runs a turn, then reloads what was stored. */
  const run = async (turn: (onEvent: (event: TurnEvent) => void) => Promise<void>) => {
    setState({ busy: true, error: null, draft: "", pending: [] })
    try {
      await turn(onEvent)
    } catch (error) {
      setState("error", errorMessage(error))
    } finally {
      setState("busy", false)
      await queryClient.invalidateQueries({ queryKey: assistant.assistant.key() })
    }
  }

  const send = async () => {
    const message = text().trim()
    if (message === "" || state.busy) return
    setText("")
    let id = props.conversation()
    if (id === null) {
      try {
        id = (await startConversation()).id
      } catch (error) {
        setState("error", errorMessage(error))
        return
      }
      started = id
      props.onStarted(id)
    }
    const conversationId = id
    await run((onEvent) => sendMessage(conversationId, { text: message, context: props.context() }, onEvent))
  }

  const decideCall = async (call: ToolCallPart, approve: boolean) => {
    const id = props.conversation()
    if (id === null || state.busy) return
    await run((onEvent) => decide(id, [{ call: call.id, approve }], onEvent))
    // An allowed change may have changed what the page shows: everything is fetched again.
    if (approve) await queryClient.invalidateQueries()
  }

  return (
    <div class={styles.root}>
      <div class={styles.scroller} ref={scroller}>
        <div class={cx(styles.messages, props.readable === true && styles.readable)}>
          <Show
            when={state.messages.length > 0 || state.busy}
            fallback={
              <p class={styles.empty}>
                <Show when={status.data?.enabled !== false} fallback="The assistant is not set up yet: ask an admin.">
                  Ask about anything in your apps. Changes run only once you allow them.
                </Show>
              </p>
            }
          >
            <For each={state.messages}>
              {(message) => (
                <Show when={message.role !== "tool"}>
                  <Show
                    when={message.role === "assistant"}
                    fallback={
                      <div class={styles.user}>
                        {message.parts.flatMap((part) => (part.type === "text" ? [part.text] : [])).join("\n")}
                      </div>
                    }
                  >
                    <div class={styles.reply}>
                      <For each={message.parts}>
                        {(part) =>
                          part.type === "text" ? (
                            <Markdown text={part.text} />
                          ) : part.type === "tool-call" ? (
                            <div class={styles.call}>
                              <Wrench size={12} />
                              <span>
                                {part.title} · {callState(part, results(), pendingIds())}
                              </span>
                            </div>
                          ) : null
                        }
                      </For>
                    </div>
                  </Show>
                </Show>
              )}
            </For>
            <Show when={state.draft !== ""}>
              <Markdown text={state.draft} />
            </Show>
            <Show when={state.busy && state.draft === ""}>
              <Spinner size="sm" />
            </Show>
            {/* A turn that failed earlier stored the question but no answer. */}
            <Show when={!state.busy && state.error === null && state.messages.at(-1)?.role === "user"}>
              <span class={styles.hint}>No reply to this message. Send it again to retry.</span>
            </Show>
            <For each={state.pending}>
              {(call) => (
                <ApprovalCard call={call} busy={state.busy} onDecide={(approve) => void decideCall(call, approve)} />
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
          </Show>
        </div>
      </div>

      <form
        class={styles.composer}
        onSubmit={(event) => {
          event.preventDefault()
          void send()
        }}
      >
        <div
          class={cx(
            css({ display: "flex", flexDirection: "column", gap: "2" }),
            props.readable === true && styles.composerReadable,
          )}
        >
          <Show when={state.pending.length > 0}>
            <span class={styles.hint}>Writing again skips the changes waiting above.</span>
          </Show>
          <Textarea
            aria-label="Message"
            placeholder="Ask the assistant…"
            rows={3}
            value={text()}
            disabled={status.data?.enabled === false}
            onInput={(event) => setText(event.currentTarget.value)}
            onKeyDown={(event) => {
              // Enter sends; Shift+Enter starts a new line.
              if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
                event.preventDefault()
                void send()
              }
            }}
          />
          <Button type="submit" size="sm" loading={state.busy} disabled={text().trim() === ""}>
            <Send size={14} /> Send
          </Button>
        </div>
      </form>
    </div>
  )
}
