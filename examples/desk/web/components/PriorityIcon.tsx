import { css, cva } from "@mosaik/sdk/css"
import Circle from "lucide-solid/icons/circle"
import Triangle from "lucide-solid/icons/triangle"
import TriangleExclamationPoint from "lucide-solid/icons/triangle-exclamation-point"
import { Show } from "solid-js"
import { Dynamic } from "solid-js/web"
import { PRIORITY_LABELS, type Priority } from "../../api"

const mark = cva({
  base: { display: "inline-grid", placeItems: "center", flexShrink: "0" },
  variants: {
    priority: {
      urgent: { color: "danger.plain.fg" },
      high: { color: "fg.subtle" },
      normal: { color: "fg.subtle" },
      low: { color: "fg.subtle" },
    },
  },
})

/** The same as a status beside it: one column of marks, all the same size. */
const ICON_SIZE = 14

const styles = {
  down: css({ transform: "rotate(180deg)" }),
  // Filled as the others are, with the mark in the triangle cut out in the page's colour.
  urgent: css({ "& path:not(:first-of-type)": { stroke: "canvas" } }),
}

/**
 * How pressing a request is, by shape: up for high, down for low, and red only when urgent, for that
 * to stand out from a list of them. Filled, as a
 * request's status beside it is an outline: a normal priority's circle would otherwise read as a new one's.
 */
export const PriorityIcon = (props: { priority: Priority }) => (
  <span
    class={mark({ priority: props.priority })}
    role="img"
    aria-label={`${PRIORITY_LABELS[props.priority]} priority`}
    title={PRIORITY_LABELS[props.priority]}
  >
    <Show
      when={props.priority !== "urgent"}
      fallback={<TriangleExclamationPoint size={ICON_SIZE} fill="currentColor" class={styles.urgent} />}
    >
      <Dynamic
        component={props.priority === "normal" ? Circle : Triangle}
        size={ICON_SIZE}
        fill="currentColor"
        class={props.priority === "low" ? styles.down : undefined}
      />
    </Show>
  </span>
)
