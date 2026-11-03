import type { StatusKey } from "@mosaik/core"
import { type Accessor, createSignal, onCleanup } from "solid-js"
import { onPageStatusesChange, type PageStatus, pageStatuses } from "./statuses"

/**
 * One of the app's statuses as the person sees it now, kept live: for the page to show what waits
 * there. A person may see several values of a status (their own, their permissions'): counts add up.
 *
 * @example
 * const waiting = useStatus(sales.status("orders.pending"))
 * <Show when={(waiting()?.count ?? 0) > 0}>Waiting for approval · {waiting()?.count}</Show>
 */
export const useStatus = (
  key: StatusKey,
): Accessor<{ readonly count: number; readonly statuses: ReadonlyArray<PageStatus> } | undefined> => {
  const read = () => {
    const statuses = pageStatuses(key)
    if (statuses.length === 0) return undefined
    const count = statuses.reduce((sum, status) => sum + (status.value._tag === "count" ? status.value.count : 0), 0)
    return { count, statuses }
  }
  const [status, setStatus] = createSignal(read())
  onCleanup(onPageStatusesChange(() => setStatus(read())))
  return status
}
