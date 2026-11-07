import { Button } from "@mosaik/mosaik-ui"
import type { ListNavigation } from "@mosaik/sdk/solid"
import { css } from "@mosaik/web-sdk/css"
import { Show } from "solid-js"
import type { RequestRow } from "../../api"
import type { RequestPickers } from "./pickers"

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

/** What can be done to what is marked, in view for as long as something is. */
export const BulkBar = (props: { list: ListNavigation<RequestRow>; pickers: RequestPickers }) => {
  const rows = () => props.list.targets()
  return (
    <Show when={props.list.selected().size > 0}>
      <div class={styles.bar} role="toolbar" aria-label="Selected requests">
        <span class={styles.count}>{props.list.selected().size} selected</span>
        <Button size="xs" variant="plain" onClick={() => props.pickers.assign(rows())}>
          Assign
        </Button>
        <Button size="xs" variant="plain" onClick={() => props.pickers.status(rows())}>
          Status
        </Button>
        <Button size="xs" variant="plain" onClick={() => props.pickers.priority(rows())}>
          Priority
        </Button>
        <Button size="xs" variant="plain" onClick={() => props.pickers.queue(rows())}>
          Queue
        </Button>
        <Button size="xs" variant="plain" onClick={() => props.list.clearSelection()}>
          Clear
        </Button>
      </div>
    </Show>
  )
}
