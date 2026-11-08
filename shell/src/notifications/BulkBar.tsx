import type { ListNavigation } from "@mosaik/client/solid"
import { Button } from "@mosaik/mosaik-ui"
import type { InboxItem } from "@mosaik/notifications/contract"
import { css } from "@mosaik/styled-system/css"
import { Show } from "solid-js"
import type { InboxActions } from "./actions"
import { SnoozeMenu } from "./SnoozeMenu"

const styles = {
  bar: css({
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "1",
    px: "3",
    py: "2",
    borderTopWidth: "1px",
    borderColor: "border",
    bg: "gray.surface.bg",
    flexShrink: "0",
  }),
  count: css({ fontSize: "sm", fontWeight: "medium", color: "fg.default", mr: "auto" }),
}

/** What can be done to the marked items, in view for as long as some are. */
export const BulkBar = (props: { list: ListNavigation<InboxItem>; actions: InboxActions }) => {
  const marked = () => props.list.targets()
  const open = () => marked().filter((item) => item.state === "open")
  const putAway = () => marked().filter((item) => item.state !== "open")
  /** Does something to the marked items; then they are no longer marked, as on the desk. */
  const apply = (action: () => void) => () => {
    action()
    props.list.clearSelection()
  }
  return (
    <Show when={props.list.selected().size > 0}>
      <div class={styles.bar} role="toolbar" aria-label="Selected items">
        <span class={styles.count}>{props.list.selected().size} selected</span>
        <Show when={open().length > 0}>
          <Button size="xs" variant="plain" onClick={apply(() => props.actions.resolve(open()))}>
            Resolve
          </Button>
          <SnoozeMenu
            trigger={(trigger) => (
              <Button {...trigger()} size="xs" variant="plain">
                Snooze
              </Button>
            )}
            onSnooze={(time) => apply(() => props.actions.snooze(open(), time))()}
          />
          <Button size="xs" variant="plain" onClick={apply(() => props.actions.markRead(open()))}>
            Mark as read
          </Button>
        </Show>
        <Show when={putAway().length > 0}>
          <Button size="xs" variant="plain" onClick={apply(() => props.actions.reopen(putAway()))}>
            Bring back
          </Button>
        </Show>
        <Button size="xs" variant="plain" onClick={() => props.list.clearSelection()}>
          Clear
        </Button>
      </div>
    </Show>
  )
}
