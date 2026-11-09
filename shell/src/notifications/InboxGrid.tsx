import type { ListNavigation } from "@mosaik/client/solid"
import type { InboxItem } from "@mosaik/notifications/contract"
import { css } from "@mosaik/styled-system/css"
import { Checkbox } from "@mosaik/ui"
import { createMemo, For, type JSX, Match, Show, Switch } from "solid-js"
import type { InboxActions } from "./actions"
import { RowActions, RowContent, rowActionsReveal } from "./InboxRow"
import type { Section } from "./model"

const styles = {
  heading: css({
    position: "sticky",
    top: "0",
    zIndex: "1",
    px: "3",
    pt: "3",
    pb: "1",
    fontSize: "xs",
    fontWeight: "medium",
    color: "fg.muted",
    bg: "bg",
  }),
  row: css({
    position: "relative",
    display: "flex",
    alignItems: "center",
    gap: "2",
    px: "3",
    py: "2",
    cursor: "pointer",
    outline: "none",
    _hover: { bg: "gray.subtle" },
    // Where the person is, and so what the pane shows.
    '&[data-active]:not([aria-selected="true"])': { bg: "gray.subtle.hover" },
    // What they have marked: something they set, so the accent, whether or not they are on it.
    '&[aria-selected="true"]': { bg: "accent.subtle", _hover: { bg: "accent.subtle.hover" } },
    _focusVisible: { boxShadow: "inset 2px 0 0 {colors.accent.solid}" },
    // Arrived while the list was open: it slides in where it lands, unless the person asks for less motion.
    "&[data-arrived]": {
      animation: "slide-in-top token(durations.normal) token(easings.out)",
      _motionReduce: { animationName: "fade-in" },
    },
    ...rowActionsReveal,
  }),
  cell: css({ display: "flex", alignItems: "center", gap: "2", flex: "1", minW: "0" }),
  // A column of its own, so that showing the checkbox moves nothing. It shows where it is about to be
  // used, and always where there is no pointer to bring it up.
  check: css({
    width: "4",
    flexShrink: "0",
    display: "grid",
    placeItems: "center",
    opacity: "0",
    "[data-row-id]:hover &": { opacity: "1" },
    // Marking one means more are likely to follow.
    "[data-selecting] &": { opacity: "1" },
    "&:focus-within": { opacity: "1" },
    "@media (hover: none)": { opacity: "1" },
  }),
}

/**
 * The inbox's list: one Tab stop moved through by keyboard (`navigation`), where the active row is
 * what the reading pane shows, and rows can be marked to act on together. Rows are keyed by id, so a
 * refresh keeps them and the focus in them.
 */
export const InboxGrid = (props: {
  sections: ReadonlyArray<Section>
  navigation: ListNavigation<InboxItem>
  actions: InboxActions
  /** Items that arrived since the list was shown: they slide in. */
  arrivals: ReadonlySet<number>
  empty: JSX.Element
}) => {
  const now = Date.now()
  // Headings and row ids, flat: keyed by string, a row keeps its element when the data refreshes.
  const entries = createMemo(() =>
    props.sections.flatMap((section) => [
      `heading:${section.heading}`,
      ...section.items.map((item) => String(item.id)),
    ]),
  )
  const byId = createMemo(
    () => new Map(props.sections.flatMap((section) => section.items).map((item) => [String(item.id), item])),
  )

  return (
    <Show when={props.sections.length > 0} fallback={props.empty}>
      <div data-selecting={props.navigation.selected().size > 0 ? "" : undefined} {...props.navigation.listProps}>
        <For each={entries()}>
          {(entry) => (
            <Switch>
              <Match when={entry.startsWith("heading:")}>
                <div class={styles.heading} role="presentation">
                  {entry.slice("heading:".length)}
                </div>
              </Match>
              <Match when={byId().get(entry)}>
                {(item) => (
                  <div
                    class={styles.row}
                    data-arrived={props.arrivals.has(item().id) ? "" : undefined}
                    {...props.navigation.rowProps(entry)}
                  >
                    {/* biome-ignore lint/a11y/useSemanticElements: a grid of rows, not a table: `createListNavigation` gives them their keyboard. */}
                    {/* biome-ignore lint/a11y/useFocusableInteractive: the row holds focus, as the grid's one Tab stop. */}
                    <div class={styles.cell} role="gridcell">
                      <span class={styles.check}>
                        <Checkbox.Root
                          size="sm"
                          checked={props.navigation.selected().has(entry)}
                          onCheckedChange={() => props.navigation.toggle(entry)}
                        >
                          <Checkbox.HiddenInput aria-label={`Select: ${item().content.title}`} tabIndex={-1} />
                          <Checkbox.Control />
                        </Checkbox.Root>
                      </span>
                      <RowContent item={item()} now={now} />
                    </div>
                    <RowActions item={item()} actions={props.actions} />
                  </div>
                )}
              </Match>
            </Switch>
          )}
        </For>
      </div>
    </Show>
  )
}
