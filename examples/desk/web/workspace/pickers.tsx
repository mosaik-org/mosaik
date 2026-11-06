import { UserAvatar } from "@mosaik/sdk/ui"
import {
  PRIORITIES,
  PRIORITY_LABELS,
  type Priority,
  QueueId,
  type RequestRow,
  type RequestStatus,
  requestNumber,
  SETTABLE_STATUSES,
  STATUS_LABELS,
} from "../../api"
import { PriorityIcon } from "../components/PriorityIcon"
import { StatusIcon } from "../components/StatusIcon"
import { Unassigned } from "../components/Unassigned"
import type { Desk } from "../context"

/** "REQ-12", or "3 requests": what is being changed, in the fewest words. */
const named = (rows: ReadonlyArray<RequestRow>) => {
  const [first] = rows
  return rows.length === 1 && first !== undefined ? requestNumber(first.id) : `${rows.length} requests`
}

/** The one value they share, to mark as current in a picker. */
const shared = <V,>(rows: ReadonlyArray<RequestRow>, value: (row: RequestRow) => V): V | undefined => {
  const [first, ...rest] = rows
  return first !== undefined && rest.every((row) => value(row) === value(first)) ? value(first) : undefined
}

export interface RequestPickers {
  readonly assign: (rows: ReadonlyArray<RequestRow>) => void
  readonly status: (rows: ReadonlyArray<RequestRow>) => void
  readonly priority: (rows: ReadonlyArray<RequestRow>) => void
  readonly queue: (rows: ReadonlyArray<RequestRow>) => void
  readonly assignToMe: (rows: ReadonlyArray<RequestRow>) => void
  readonly setStatus: (rows: ReadonlyArray<RequestRow>, status: RequestStatus) => void
}

/** Every way to change a request's fields, the same from a key, a button or the bar over a selection. */
export const createRequestPickers = (desk: Desk, afterChange: () => void = () => {}): RequestPickers => {
  const NOBODY = "nobody"

  const assignTo = (rows: ReadonlyArray<RequestRow>, assigneeId: string | null, who: string) => {
    void desk.actions.edit(
      rows.map((row) => ({ id: row.id, change: { assigneeId } })),
      assigneeId === null ? `${named(rows)} unassigned` : `${named(rows)} assigned to ${who}`,
    )
    afterChange()
  }

  const setStatus = (rows: ReadonlyArray<RequestRow>, status: RequestStatus) => {
    void desk.actions.edit(
      rows.map((row) => ({ id: row.id, change: { status } })),
      `${named(rows)}: ${STATUS_LABELS[status].toLowerCase()}`,
    )
    afterChange()
  }

  return {
    setStatus,
    assignToMe: (rows) => assignTo(rows, desk.me(), "you"),
    assign: (rows) => {
      const me = desk.me()
      const others = desk.agents().filter((agent) => agent.id !== me)
      desk.picker.open({
        title: `Assign ${named(rows)}`,
        placeholder: "Assign to…",
        current: shared(rows, (row) => row.assigneeId ?? NOBODY),
        items: [
          { value: me, label: "Me" },
          ...others.map((agent) => ({
            value: agent.id,
            label: agent.name,
            icon: <UserAvatar user={agent} size="2xs" />,
          })),
          { value: NOBODY, label: "Unassigned", icon: <Unassigned /> },
        ],
        onPick: (value) => {
          const who = value === me ? "you" : (others.find((agent) => agent.id === value)?.name ?? "them")
          assignTo(rows, value === NOBODY ? null : value, who)
        },
      })
    },
    status: (rows) =>
      desk.picker.open({
        title: `Status of ${named(rows)}`,
        placeholder: "Set status…",
        current: shared(rows, (row) => row.status),
        items: SETTABLE_STATUSES.map((status) => ({
          value: status,
          label: STATUS_LABELS[status],
          icon: <StatusIcon status={status} />,
        })),
        onPick: (value) => setStatus(rows, value as RequestStatus),
      }),
    priority: (rows) =>
      desk.picker.open({
        title: `Priority of ${named(rows)}`,
        placeholder: "Set priority…",
        current: shared(rows, (row) => row.priority),
        items: PRIORITIES.map((priority) => ({
          value: priority,
          label: PRIORITY_LABELS[priority],
          icon: <PriorityIcon priority={priority} />,
        })),
        onPick: (value) => {
          void desk.actions.edit(
            rows.map((row) => ({ id: row.id, change: { priority: value as Priority } })),
            `${named(rows)}: ${PRIORITY_LABELS[value as Priority].toLowerCase()} priority`,
          )
          afterChange()
        },
      }),
    queue: (rows) =>
      desk.picker.open({
        title: `Move ${named(rows)}`,
        placeholder: "Move to queue…",
        current: shared(rows, (row) => String(row.queueId)),
        items: desk.queues().map((queue) => ({
          value: String(queue.id),
          label: queue.name,
          description: queue.description,
        })),
        onPick: (value) => {
          const queue = desk.queues().find((candidate) => String(candidate.id) === value)
          void desk.actions.edit(
            rows.map((row) => ({ id: row.id, change: { queueId: QueueId.make(Number(value)) } })),
            `${named(rows)} moved to ${queue?.name ?? "another queue"}`,
          )
          afterChange()
        },
      }),
  }
}
