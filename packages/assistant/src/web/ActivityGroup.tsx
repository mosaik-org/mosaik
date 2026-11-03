import { Spinner } from "@mosaik/mosaik-ui"
import { css } from "@mosaik/styled-system/css"
import Ban from "lucide-solid/icons/ban"
import ChevronRight from "lucide-solid/icons/chevron-right"
import CircleAlert from "lucide-solid/icons/circle-alert"
import CircleCheck from "lucide-solid/icons/circle-check"
import Clock from "lucide-solid/icons/clock"
import { createMemo, createSignal, For, type JSX, Match, Show, Switch } from "solid-js"
import type { ToolCallPart } from "../contract"
import { useAppName } from "./browser"
import { activitySummary, type CallStatus } from "./view"

const styles = {
  root: css({ display: "flex", flexDirection: "column", gap: "1", fontSize: "xs", color: "fg.muted" }),
  toggle: css({
    display: "inline-flex",
    alignItems: "center",
    gap: "1.5",
    alignSelf: "flex-start",
    px: "2",
    py: "1",
    ml: "-2",
    borderRadius: "l2",
    cursor: "pointer",
    _hover: { bg: "gray.subtle.bg", color: "fg.default" },
    _focusVisible: { outline: "2px solid", outlineColor: "accent.solid.bg" },
  }),
  chevron: css({ transition: "transform 0.15s", "[aria-expanded=true] > &": { transform: "rotate(90deg)" } }),
  list: css({ display: "flex", flexDirection: "column", gap: "1", pl: "2", ml: "1", borderLeftWidth: "2px" }),
  row: css({ display: "flex", alignItems: "flex-start", gap: "1.5", py: "0.5" }),
  app: css({ color: "fg.subtle" }),
  reason: css({ color: "danger.plain.fg", overflowWrap: "anywhere" }),
}

const StatusIcon = (props: { readonly status: CallStatus }) => (
  <Switch>
    <Match when={props.status.state === "running"}>
      <Spinner size="xs" />
    </Match>
    <Match when={props.status.state === "waiting"}>
      <Clock size={14} />
    </Match>
    <Match when={props.status.state === "done"}>
      <CircleCheck size={14} class={css({ color: "success.plain.fg" })} />
    </Match>
    <Match when={props.status.state === "denied"}>
      <Ban size={14} />
    </Match>
    <Match when={props.status.state === "failed"}>
      <CircleAlert size={14} class={css({ color: "danger.plain.fg" })} />
    </Match>
  </Switch>
)

/**
 * A reply's tool calls as one line that says what is going on (or what they came to), opening to
 * each call with its app and status, and why a failed one failed.
 */
export const ActivityGroup = (props: {
  readonly calls: ReadonlyArray<ToolCallPart>
  readonly statuses: ReadonlyArray<CallStatus>
}): JSX.Element => {
  const [open, setOpen] = createSignal(false)
  const appName = useAppName()
  const overall = createMemo<CallStatus>(() => {
    const states = props.statuses.map((status) => status.state)
    if (states.includes("running")) return { state: "running" }
    if (states.includes("waiting")) return { state: "waiting" }
    const failed = props.statuses.find((status) => status.state === "failed")
    return failed ?? { state: states.includes("denied") ? "denied" : "done" }
  })
  return (
    <div class={styles.root}>
      <button type="button" class={styles.toggle} aria-expanded={open()} onClick={() => setOpen((value) => !value)}>
        <StatusIcon status={overall()} />
        <span>{activitySummary(props.calls, props.statuses)}</span>
        <ChevronRight size={14} class={styles.chevron} />
      </button>
      <Show when={open()}>
        <ul class={styles.list}>
          <For each={props.calls}>
            {(call, index) => {
              const status = () => props.statuses[index()] ?? { state: "running" as const }
              return (
                <li class={styles.row}>
                  <StatusIcon status={status()} />
                  <span>
                    {call.title}
                    <Show when={call.app !== ""}>
                      <span class={styles.app}> · {appName(call.app)}</span>
                    </Show>
                    <Show when={status().state === "failed" && status()}>
                      {(failed) => (
                        <span class={styles.reason}> — {(failed() as { reason: string }).reason.slice(0, 300)}</span>
                      )}
                    </Show>
                  </span>
                </li>
              )
            }}
          </For>
        </ul>
      </Show>
    </div>
  )
}
