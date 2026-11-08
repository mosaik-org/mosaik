import { toast } from "@mosaik/client"
import type { InboxItem, Severity } from "@mosaik/notifications/contract"
import { css } from "@mosaik/styled-system/css"
import { For, type JSX, Show } from "solid-js"
import type { InboxActions } from "./actions"
import { RowActions, RowContent, rowActionsReveal } from "./InboxRow"
import type { Section } from "./model"

export const severityToast = (severity: Severity | undefined) =>
  severity === "critical" ? toast.error : severity === "success" ? toast.success : toast.info

const styles = {
  sections: css({ display: "flex", flexDirection: "column", gap: "2", py: "2" }),
  heading: css({
    px: "4",
    pb: "1",
    fontSize: "xs",
    fontWeight: "semibold",
    color: "fg.muted",
    textTransform: "uppercase",
    letterSpacing: "wider",
  }),
  row: css({ position: "relative", _hover: { bg: "gray.subtle.bg" }, ...rowActionsReveal }),
  item: css({
    display: "flex",
    w: "full",
    px: "4",
    py: "2",
    textAlign: "start",
    cursor: "pointer",
    _focusVisible: { outline: "2px solid", outlineColor: "accent.solid.bg", outlineOffset: "-2px" },
  }),
}

/**
 * A short list of inbox items under headings, each a button that opens it: the bell's and the
 * Overview's. With `actions`, each can be resolved or snoozed where it is. The inbox itself is a grid
 * moved through by keyboard (`InboxGrid`).
 */
export const NotificationList = (props: {
  sections: ReadonlyArray<Section>
  onOpen: (item: InboxItem) => void
  actions?: InboxActions
  empty: JSX.Element
  /** How many lines of what it says each shows (1 in the bell's panel). */
  lines?: 1 | 2
}) => {
  const now = Date.now()
  return (
    <Show when={props.sections.length > 0} fallback={props.empty}>
      <div class={styles.sections}>
        <For each={props.sections}>
          {(section) => (
            <section aria-label={section.heading}>
              <h3 class={styles.heading}>{section.heading}</h3>
              <ul>
                <For each={section.items}>
                  {(item) => (
                    <li class={styles.row}>
                      <button type="button" class={styles.item} onClick={() => props.onOpen(item)}>
                        <RowContent item={item} now={now} lines={props.lines} />
                      </button>
                      <Show when={props.actions}>{(actions) => <RowActions item={item} actions={actions()} />}</Show>
                    </li>
                  )}
                </For>
              </ul>
            </section>
          )}
        </For>
      </div>
    </Show>
  )
}
