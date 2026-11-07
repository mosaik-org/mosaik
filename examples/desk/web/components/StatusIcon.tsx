import { cva } from "@mosaik/web-sdk/css"
import Circle from "lucide-solid/icons/circle"
import CircleCheck from "lucide-solid/icons/circle-check"
import CirclePause from "lucide-solid/icons/circle-pause"
import Contrast from "lucide-solid/icons/contrast"
import { Dynamic } from "solid-js/web"
import { REQUESTER_STATUS_LABELS, type RequestStatus, STATUS_LABELS } from "../../api"

const ICONS = { new: Circle, open: Contrast, waiting: CirclePause, solved: CircleCheck, closed: CircleCheck }

const mark = cva({
  base: { display: "inline-grid", placeItems: "center", flexShrink: "0" },
  variants: {
    tone: {
      // Grey, as a list shows many: shape tells them apart, and colour is left for what is late.
      new: { color: "fg.subtle" },
      open: { color: "fg.subtle" },
      waiting: { color: "fg.subtle" },
      solved: { color: "green.plain.fg" },
      closed: { color: "fg.subtle" },
      // The same status, for the person it waits for: their move, so the accent.
      yourTurn: { color: "accent.plain.fg" },
    },
  },
})

/** Where a request stands, by shape, so it reads without the word and without colour. */
export const StatusIcon = (props: { status: RequestStatus; forRequester?: boolean }) => {
  const labels = () => (props.forRequester ? REQUESTER_STATUS_LABELS : STATUS_LABELS)
  return (
    <span
      class={mark({ tone: props.forRequester && props.status === "waiting" ? "yourTurn" : props.status })}
      role="img"
      aria-label={labels()[props.status]}
      title={labels()[props.status]}
    >
      <Dynamic component={ICONS[props.status]} size={14} />
    </span>
  )
}
