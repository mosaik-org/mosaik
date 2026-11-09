import { useNow } from "@mosaik/sdk/solid"
import { cva } from "@mosaik/web-sdk/css"
import { DateTime } from "effect"
import { Show } from "solid-js"
import { type DeadlineKind, type DeadlineState, deadlineOf, type RequestRow, shortDuration } from "../../api"

/** How much time is left: grey while there is plenty, amber when short, red once gone. */
const chip = cva({
  base: { flexShrink: "0", fontSize: "xs", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" },
  variants: {
    state: {
      ok: { color: "fg.muted" },
      soon: { color: "warning.fg", fontWeight: "medium" },
      missed: { color: "danger.fg", fontWeight: "medium" },
    },
  },
})

const DOING: Readonly<Record<DeadlineKind, string>> = { reply: "Reply", solve: "Solve" }

const words = (kind: DeadlineKind, state: DeadlineState, millisLeft: number) =>
  state === "missed" ? `Overdue ${shortDuration(millisLeft)}` : `${DOING[kind]} in ${shortDuration(millisLeft)}`

export const DeadlineChip = (props: { request: RequestRow }) => {
  const now = useNow()
  const deadline = () => deadlineOf(props.request, DateTime.makeUnsafe(now()))
  return (
    <Show when={deadline()}>
      {(due) => <span class={chip({ state: due().state })}>{words(due().kind, due().state, due().millisLeft)}</span>}
    </Show>
  )
}
