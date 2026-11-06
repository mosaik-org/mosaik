import { errorMessage, toast } from "@mosaik/sdk/client"
import { useQueryClient } from "@tanstack/solid-query"
import { DateTime } from "effect"
import { type Accessor, createSignal } from "solid-js"
import {
  applyChange,
  type DeadlineRule,
  type NewReply,
  type Person,
  type Queue,
  type RequestChange,
  type RequestEdit,
  type RequestId,
  RequestRow,
  RequestsPage,
} from "../api"
import { deskApi } from "./queries"

interface Lookups {
  readonly me: Accessor<string>
  readonly queues: Accessor<ReadonlyArray<Queue>>
  readonly agents: Accessor<ReadonlyArray<Person>>
  readonly deadlines: Accessor<ReadonlyArray<DeadlineRule>>
}

export interface RequestActions {
  /**
   * Changes requests, showing it at once: the screen follows before the backend has answered, and goes
   * back if it refuses. Says what happened, with a way to undo it.
   */
  readonly edit: (edits: ReadonlyArray<RequestEdit>, message: string) => Promise<boolean>
  readonly reply: (id: RequestId, reply: NewReply) => Promise<boolean>
  readonly remove: (id: RequestId) => Promise<boolean>
  /** Takes back the last change, if there is one. Says whether there was. */
  readonly undoLast: () => boolean
  /** The request stopped being news to this person. */
  readonly markRead: (id: RequestId) => void
}

const LIST = deskApi.requests.list.key()
const ONE = deskApi.requests.get.key()

export const createRequestActions = (lookups: Lookups): RequestActions => {
  const client = useQueryClient()
  const [lastUndo, setLastUndo] = createSignal<ReadonlyArray<RequestEdit>>()

  /** A row with a change applied, by the same rules the backend will use. */
  const patched = (row: RequestRow, change: RequestChange, now: DateTime.Utc): RequestRow => {
    const priority = change.priority ?? row.priority
    const rule = lookups.deadlines().find((candidate) => candidate.priority === priority) ?? {
      respondMinutes: 0,
      resolveMinutes: 0,
    }
    // Without its rule it cannot say what the deadlines become: they move when the backend answers.
    const usable = lookups.deadlines().length > 0 ? change : { ...change, priority: undefined }
    const next = applyChange(row, usable, rule, lookups.me(), now)
    return new RequestRow({
      ...next,
      priority,
      assignee:
        next.assigneeId === null
          ? null
          : next.assigneeId === row.assigneeId
            ? row.assignee
            : (lookups.agents().find((agent) => agent.id === next.assigneeId) ?? row.assignee),
      queueName: lookups.queues().find((queue) => queue.id === next.queueId)?.name ?? row.queueName,
    })
  }

  const patchCached = (update: (row: RequestRow) => RequestRow) => {
    client.setQueriesData<RequestsPage>(
      { queryKey: LIST },
      (page) => page && new RequestsPage({ ...page, rows: page.rows.map(update) }),
    )
    client.setQueriesData<RequestRow>({ queryKey: ONE }, (row) => row && update(row))
  }

  const refetch = () => client.invalidateQueries({ queryKey: deskApi.requests.key() })

  const edit = async (edits: ReadonlyArray<RequestEdit>, message: string, undoable = true) => {
    await client.cancelQueries({ queryKey: deskApi.requests.key() })
    const before = client.getQueriesData({ queryKey: deskApi.requests.key() })
    const now = DateTime.nowUnsafe()
    const byId = new Map(edits.map((one) => [one.id, one.change]))
    patchCached((row) => {
      const change = byId.get(row.id)
      return change === undefined ? row : patched(row, change, now)
    })
    try {
      const result = await deskApi.requests.edit.call({ payload: { edits } })
      if (undoable) {
        setLastUndo(result.undo)
        toast.success(message, undefined, { label: "Undo", onClick: () => undoLast() })
      } else {
        setLastUndo(undefined)
        toast.info(message)
      }
      return true
    } catch (error) {
      for (const [key, data] of before) client.setQueryData(key, data)
      toast.error("That did not work", errorMessage(error))
      return false
    } finally {
      void refetch()
    }
  }

  const undoLast = () => {
    const undo = lastUndo()
    if (undo === undefined) return false
    setLastUndo(undefined)
    void edit(undo, "Undone", false)
    return true
  }

  return {
    edit: (edits, message) => edit(edits, message),
    undoLast,
    reply: async (id, reply) => {
      try {
        await deskApi.requests.reply.call({ params: { id }, payload: reply })
        toast.success(reply.kind === "note" ? "Note added" : reply.solve === true ? "Sent and solved" : "Reply sent")
        return true
      } catch (error) {
        toast.error("That was not sent", errorMessage(error))
        return false
      } finally {
        void refetch()
      }
    },
    remove: async (id) => {
      try {
        await deskApi.requests.remove.call({ params: { id } })
        toast.success("Request deleted")
        return true
      } catch (error) {
        toast.error("That was not deleted", errorMessage(error))
        return false
      } finally {
        void refetch()
      }
    },
    markRead: (id) => {
      patchCached((row) => (row.id === id && row.unread ? new RequestRow({ ...row, unread: false }) : row))
      void deskApi.requests.markRead.call({ params: { id } }).catch(() => {
        // It only means it stands out once more next time.
      })
    },
  }
}
