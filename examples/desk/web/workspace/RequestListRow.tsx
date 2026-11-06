import { Checkbox } from "@mosaik/mosaik-ui"
import { css } from "@mosaik/sdk/css"
import type { ListNavigation } from "@mosaik/sdk/solid"
import { UserAvatar } from "@mosaik/sdk/ui"
import { Show } from "solid-js"
import { REQUESTER_STATUS_LABELS, type RequestRow, requestNumber } from "../../api"
import { DeadlineChip } from "../components/DeadlineChip"
import { PriorityIcon } from "../components/PriorityIcon"
import { StatusIcon } from "../components/StatusIcon"
import { Unassigned } from "../components/Unassigned"

const styles = {
  row: css({
    position: "relative",
    display: "block",
    px: "3",
    py: "2",
    cursor: "pointer",
    outline: "none",
    borderBottomWidth: "1px",
    borderColor: "border.subtle",
    _hover: { bg: "gray.subtle.bg" },
    // Where the person is.
    '&[data-active]:not([aria-selected="true"])': { bg: "gray.subtle.bg.hover" },
    // What they have marked: something they set, so the accent, whether or not they are on it.
    '&[aria-selected="true"]': { bg: "accent.subtle.bg", _hover: { bg: "accent.subtle.bg.hover" } },
    _focusVisible: { boxShadow: "inset 2px 0 0 {colors.accent.solid.bg}" },
  }),
  cell: css({ display: "flex", gap: "2", minW: "0" }),
  line: css({ display: "flex", alignItems: "center", gap: "2", minW: "0" }),
  title: css({
    flex: "1",
    minW: "0",
    truncate: true,
    fontSize: "sm",
    color: "fg.default",
    // New to this person. Read ones stay as legible: having seen it does not make it less pressing.
    "&[data-unread]": { fontWeight: "semibold" },
  }),
  meta: css({ flex: "1", minW: "0", truncate: true, fontSize: "xs", color: "fg.muted" }),
  // Lines up what is on either line of a row, as a column.
  lead: css({ width: "4", height: "4", flexShrink: "0", display: "grid", placeItems: "center" }),
  // A column of its own, so that showing the checkbox moves nothing and hides nothing. It shows where
  // it is about to be used, and always where there is no pointer to bring it up.
  check: css({
    width: "4",
    height: "5",
    flexShrink: "0",
    display: "grid",
    placeItems: "center",
    opacity: "0",
    "[data-row-id]:hover &": { opacity: "1" },
    // Selecting one means more are likely to follow.
    "[data-selecting] &": { opacity: "1" },
    "&:focus-within": { opacity: "1" },
    "@media (hover: none)": { opacity: "1" },
  }),
  lines: css({ display: "flex", flexDirection: "column", gap: "1", flex: "1", minW: "0" }),
  yourTurn: css({ flexShrink: "0", fontSize: "xs", fontWeight: "medium", color: "accent.plain.fg" }),
}

/** One request in a list: what it is about, what makes it pressing, and who has it. */
export const RequestListRow = (props: {
  id: string
  row: RequestRow | undefined
  list: ListNavigation<RequestRow>
  forRequester: boolean
}) => (
  <div class={styles.row} {...props.list.rowProps(props.id)}>
    {/* biome-ignore lint/a11y/useSemanticElements: a grid of rows, not a table: `createListNavigation` gives them their keyboard. */}
    {/* biome-ignore lint/a11y/useFocusableInteractive: the row holds focus, as the grid's one Tab stop. */}
    <div class={styles.cell} role="gridcell">
      <Show when={props.row}>
        {(row) => (
          <>
            <Show when={!props.forRequester}>
              <span class={styles.check}>
                <Checkbox.Root
                  size="sm"
                  checked={props.list.selected().has(props.id)}
                  onCheckedChange={() => props.list.toggle(props.id)}
                >
                  <Checkbox.HiddenInput aria-label={`Select ${requestNumber(row().id)}`} tabIndex={-1} />
                  <Checkbox.Control>
                    <Checkbox.Indicator />
                  </Checkbox.Control>
                </Checkbox.Root>
              </span>
            </Show>
            <div class={styles.lines}>
              <div class={styles.line}>
                <span class={styles.lead}>
                  {/* Most requests are normal: only what is out of the ordinary gets a mark. */}
                  <Show when={row().priority !== "normal"}>
                    <PriorityIcon priority={row().priority} />
                  </Show>
                </span>
                <span class={styles.title} data-unread={row().unread ? "" : undefined}>
                  {row().title}
                </span>
                <Show when={props.forRequester} fallback={<DeadlineChip request={row()} />}>
                  <Show when={row().status === "waiting"}>
                    <span class={styles.yourTurn}>Your turn</span>
                  </Show>
                </Show>
              </div>
              <div class={styles.line}>
                <span class={styles.lead}>
                  <StatusIcon status={row().status} forRequester={props.forRequester} />
                </span>
                <span class={styles.meta}>
                  {props.forRequester
                    ? // In words too: unlike the people working on requests, they see these rarely.
                      `${requestNumber(row().id)} · ${row().queueName} · ${REQUESTER_STATUS_LABELS[row().status]}`
                    : `${requestNumber(row().id)} · ${row().requester.name} · ${row().queueName}`}
                </span>
                <Show when={row().assignee} fallback={<Unassigned />}>
                  {(assignee) => <UserAvatar user={assignee()} size="2xs" />}
                </Show>
              </div>
            </div>
          </>
        )}
      </Show>
    </div>
  </div>
)
