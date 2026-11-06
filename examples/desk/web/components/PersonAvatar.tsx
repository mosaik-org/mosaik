import { Avatar } from "@mosaik/mosaik-ui"
import { css } from "@mosaik/sdk/css"
import CircleDashed from "lucide-solid/icons/circle-dashed"
import type { Person } from "../../api"

const styles = { nobody: css({ display: "inline-grid", placeItems: "center", flexShrink: "0", color: "fg.subtle" }) }

export const PersonAvatar = (props: { person: Person; size?: "2xs" | "xs" | "sm" | "md" }) => (
  <Avatar.Root size={props.size ?? "xs"} title={props.person.name}>
    <Avatar.Fallback name={props.person.name} />
    <Avatar.Image src={props.person.image ?? undefined} alt="" />
  </Avatar.Root>
)

/** Where an avatar would be when nobody has a request: an empty place, rather than nothing to notice. */
export const Unassigned = () => (
  <span class={styles.nobody} role="img" aria-label="Unassigned" title="Unassigned">
    <CircleDashed size={24} stroke-width={1.5} />
  </span>
)
