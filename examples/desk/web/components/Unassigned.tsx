import { css } from "@mosaik/web-sdk/css"
import CircleDashed from "lucide-solid/icons/circle-dashed"

const styles = { nobody: css({ display: "inline-grid", placeItems: "center", flexShrink: "0", color: "fg.subtle" }) }

/** Where an avatar would be when nobody has a request: an empty place, rather than nothing to notice. */
export const Unassigned = () => (
  <span class={styles.nobody} role="img" aria-label="Unassigned" title="Unassigned">
    <CircleDashed size={24} stroke-width={1.5} />
  </span>
)
