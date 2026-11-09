import { formatDateTime } from "@mosaik/sdk/client"
import { Button, Tooltip } from "@mosaik/ui"
import { css } from "@mosaik/web-sdk/css"
import { UserAvatar } from "@mosaik/web-sdk/ui"
import { type JSX, Show } from "solid-js"
import { Portal } from "solid-js/web"
import { PRIORITY_LABELS, REQUESTER_STATUS_LABELS, type RequestRow, STATUS_LABELS } from "../../api"
import { DeadlineChip } from "../components/DeadlineChip"
import { PriorityIcon } from "../components/PriorityIcon"
import { StatusIcon } from "../components/StatusIcon"
import { Unassigned } from "../components/Unassigned"
import type { RequestPickers } from "../workspace/pickers"
import { Attachments } from "./Attachments"

const styles = {
  root: css({
    display: "flex",
    flexDirection: { base: "row", lg: "column" },
    flexWrap: { base: "wrap", lg: "nowrap" },
    gap: { base: "3", lg: "1" },
    overflowY: { lg: "auto" },
    px: { base: "4", lg: "3" },
    py: "3",
    borderLeftWidth: { lg: "1px" },
    borderBottomWidth: { base: "1px", lg: "0" },
    borderColor: "border",
    gridRow: { base: "1", lg: "1" },
    minW: "0",
  }),
  field: css({ display: "flex", flexDirection: "column", gap: "0.5", minW: "0" }),
  label: css({ fontSize: "xs", color: "fg.muted", px: { lg: "2" }, pt: { lg: "2" } }),
  value: css({
    display: "flex",
    alignItems: "center",
    gap: "2",
    fontSize: "sm",
    minW: "0",
    px: { lg: "2" },
    minH: "7",
  }),
  button: css({ justifyContent: "flex-start", width: "full", minW: "0" }),
  // Sized to the line of text it sits on, a little under the smallest avatar.
  avatar: css({ boxSize: "6" }),
  text: css({ truncate: true }),
  separator: css({ my: "2", borderTopWidth: "1px", borderColor: "border", hideBelow: "lg" }),
}

const Field = (props: { label: string; children: JSX.Element }) => (
  <div class={styles.field}>
    <div class={styles.label}>{props.label}</div>
    {props.children}
  </div>
)

/** A value that opens its picker, with the key that does the same in its tooltip, so people pick it up. */
const Pick = (props: { label: string; keyName: string; onClick: () => void; children: JSX.Element }) => (
  <Tooltip.Root>
    <Tooltip.Trigger
      asChild={(trigger) => (
        <Button {...trigger()} class={styles.button} size="sm" variant="ghost" onClick={props.onClick}>
          {props.children}
        </Button>
      )}
    />
    <Portal>
      <Tooltip.Positioner>
        <Tooltip.Content>{`${props.label} (${props.keyName})`}</Tooltip.Content>
      </Tooltip.Positioner>
    </Portal>
  </Tooltip.Root>
)

/** Everything about a request, each to change where it shows for people who may. */
export const Attributes = (props: { row: RequestRow; asAgent: boolean; pickers: RequestPickers }) => {
  const fixed = () => props.row.status === "closed"
  const rows = () => [props.row]
  return (
    <aside class={styles.root} aria-label="About this request">
      <Show
        when={props.asAgent && !fixed()}
        fallback={
          <>
            <Field label="Status">
              <div class={styles.value}>
                <StatusIcon status={props.row.status} forRequester={!props.asAgent} />
                {props.asAgent ? STATUS_LABELS[props.row.status] : REQUESTER_STATUS_LABELS[props.row.status]}
              </div>
            </Field>
            <Field label="Handled by">
              <div class={styles.value}>
                <Show
                  when={props.row.assignee}
                  fallback={
                    <>
                      <Unassigned />
                      Nobody yet
                    </>
                  }
                >
                  {(assignee) => (
                    <>
                      <UserAvatar user={assignee()} size="xs" class={styles.avatar} />
                      <span class={styles.text}>{assignee().name}</span>
                    </>
                  )}
                </Show>
              </div>
            </Field>
          </>
        }
      >
        <Field label="Status">
          <Pick label="Change status" keyName="S" onClick={() => props.pickers.status(rows())}>
            <StatusIcon status={props.row.status} />
            {STATUS_LABELS[props.row.status]}
          </Pick>
        </Field>
        <Field label="Priority">
          <Pick label="Change priority" keyName="P" onClick={() => props.pickers.priority(rows())}>
            <PriorityIcon priority={props.row.priority} />
            {PRIORITY_LABELS[props.row.priority]}
          </Pick>
        </Field>
        <Field label="Assignee">
          <Pick label="Assign" keyName="A" onClick={() => props.pickers.assign(rows())}>
            <Show
              when={props.row.assignee}
              fallback={
                <>
                  <Unassigned />
                  Unassigned
                </>
              }
            >
              {(assignee) => (
                <>
                  <UserAvatar user={assignee()} size="xs" class={styles.avatar} />
                  <span class={styles.text}>{assignee().name}</span>
                </>
              )}
            </Show>
          </Pick>
        </Field>
        <Field label="Queue">
          <Pick label="Move to queue" keyName="Q" onClick={() => props.pickers.queue(rows())}>
            {props.row.queueName}
          </Pick>
        </Field>
      </Show>

      <div class={styles.separator} />

      <Show when={props.asAgent}>
        <Field label="Asked by">
          <div class={styles.value}>
            <UserAvatar user={props.row.requester} size="xs" class={styles.avatar} />
            <span class={styles.text}>{props.row.requester.name}</span>
          </div>
        </Field>
        <Show when={!fixed() && props.row.status !== "solved"}>
          <Field label="Deadline">
            <div class={styles.value}>
              <Show when={props.row.status === "waiting"} fallback={<DeadlineChip request={props.row} />}>
                Paused while waiting
              </Show>
            </div>
          </Field>
        </Show>
      </Show>
      <Field label="Sent">
        <div class={styles.value}>{formatDateTime(props.row.createdAt)}</div>
      </Field>

      <div class={styles.separator} />
      <Attachments id={props.row.id} mayRemove={props.asAgent} mayAdd={!fixed()} />
    </aside>
  )
}
