import { Button, Kbd, Tabs, Textarea } from "@mosaik/mosaik-ui"
import { css } from "@mosaik/web-sdk/css"
import { useQuery } from "@tanstack/solid-query"
import { createSignal, onMount, Show } from "solid-js"
import { NewReply, type ReplyKind, type RequestId } from "../../api"
import { useDesk } from "../context"
import { savedRepliesQuery } from "../queries"

const styles = {
  root: css({
    display: "flex",
    flexDirection: "column",
    gap: "2",
    px: { base: "4", lg: "6" },
    py: "3",
    borderTopWidth: "1px",
    borderColor: "border",
    flexShrink: "0",
  }),
  tabs: css({ alignSelf: "flex-start" }),
  footer: css({ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "2" }),
  hint: css({
    mr: "auto",
    display: "flex",
    alignItems: "center",
    gap: "1",
    fontSize: "xs",
    color: "fg.muted",
    hideBelow: "lg",
  }),
}

const INPUT_ID = "desk-composer"

export interface ComposerHandle {
  readonly focus: (kind: ReplyKind) => void
}

/** What someone was writing, per request: moving away for a moment and back loses nothing. */
const drafts = new Map<RequestId, { reply: string; note: string }>()

/** Where to write. Enter makes a new line; Ctrl+Enter sends; Esc leaves it as it is and goes back to the list. */
export const Composer = (props: {
  id: RequestId
  asAgent: boolean
  onLeave: () => void
  ref: (handle: ComposerHandle) => void
}) => {
  const desk = useDesk()
  const saved = useQuery(() => ({ ...savedRepliesQuery(), enabled: props.asAgent }))
  const draft = drafts.get(props.id) ?? { reply: "", note: "" }
  const [kind, setKind] = createSignal<ReplyKind>("reply")
  const [reply, setReply] = createSignal(draft.reply)
  const [note, setNote] = createSignal(draft.note)
  const [sending, setSending] = createSignal(false)
  let input: HTMLTextAreaElement | undefined

  const text = () => (kind() === "note" ? note() : reply())
  const write = (value: string) => {
    if (kind() === "note") setNote(value)
    else setReply(value)
    drafts.set(props.id, { reply: reply(), note: note() })
  }

  onMount(() =>
    props.ref({
      focus: (next) => {
        setKind(next)
        input?.focus()
      },
    }),
  )

  const send = async (solve: boolean) => {
    const body = text().trim()
    if (body === "" || sending()) return
    setSending(true)
    const sent = await desk.actions.reply(
      props.id,
      new NewReply({ body, kind: kind(), ...(solve ? { solve: true } : {}) }),
    )
    setSending(false)
    if (sent) write("")
  }

  const insertSaved = () =>
    desk.picker.open({
      title: "Insert a saved reply",
      placeholder: "Find a saved reply…",
      items: (saved.data ?? []).map((one) => ({ value: String(one.id), label: one.title, description: one.body })),
      onPick: (value) => {
        const chosen = saved.data?.find((one) => String(one.id) === value)
        if (chosen === undefined) return
        write(text() === "" ? chosen.body : `${text()}\n\n${chosen.body}`)
        input?.focus()
      },
    })

  return (
    <div class={styles.root}>
      <Show when={props.asAgent}>
        <Tabs.Root
          class={styles.tabs}
          size="xs"
          variant="subtle"
          value={kind()}
          onValueChange={(details) => setKind(details.value as ReplyKind)}
        >
          {/* Which kind the one box below writes: that is what they control, rather than panels of their own. */}
          <Tabs.List>
            <Tabs.Trigger value="reply" aria-controls={INPUT_ID}>
              Reply
            </Tabs.Trigger>
            <Tabs.Trigger value="note" aria-controls={INPUT_ID}>
              Internal note
            </Tabs.Trigger>
          </Tabs.List>
        </Tabs.Root>
      </Show>
      <Textarea
        ref={input}
        id={INPUT_ID}
        rows={3}
        aria-label={kind() === "note" ? "Internal note" : "Reply"}
        placeholder={kind() === "note" ? "Only people working on requests see this" : "Write a reply"}
        value={text()}
        onInput={(event) => write(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
            event.preventDefault()
            void send(false)
          } else if (event.key === "Escape") {
            event.preventDefault()
            props.onLeave()
          }
        }}
      />
      <div class={styles.footer}>
        <span class={styles.hint}>
          <Kbd size="sm">Ctrl</Kbd>
          <Kbd size="sm">↵</Kbd>
          to send
        </span>
        <Show when={props.asAgent && (saved.data?.length ?? 0) > 0}>
          <Button size="sm" variant="plain" onClick={insertSaved}>
            Saved replies
          </Button>
        </Show>
        <Show when={props.asAgent && kind() === "reply"}>
          <Button size="sm" variant="outline" disabled={text().trim() === ""} onClick={() => void send(true)}>
            Send and solve
          </Button>
        </Show>
        <Button size="sm" disabled={text().trim() === ""} loading={sending()} onClick={() => void send(false)}>
          {kind() === "note" ? "Add note" : "Send"}
        </Button>
      </div>
    </div>
  )
}
