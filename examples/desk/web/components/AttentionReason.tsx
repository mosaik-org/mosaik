import { cva } from "@mosaik/sdk/css"
import { useNow } from "@mosaik/sdk/solid"
import { DateTime } from "effect"
import { Show } from "solid-js"
import { attentionReason, type RequestRow } from "../../api"

/** Red once late, amber when short, as the deadlines in the list; grey while there is time. */
const line = cva({
  base: { mt: "0.5", fontSize: "sm" },
  variants: {
    state: {
      ok: { color: "fg.muted" },
      soon: { color: "warning.plain.fg" },
      missed: { color: "danger.plain.fg" },
    },
  },
})

/** Why this request is asking for someone, under its title, so opening it answers that at once. */
export const AttentionReason = (props: { request: RequestRow }) => {
  const now = useNow()
  const reason = () => attentionReason(props.request, DateTime.makeUnsafe(now()))
  return <Show when={reason()}>{(why) => <p class={line({ state: why().state })}>{why().text}</p>}</Show>
}
