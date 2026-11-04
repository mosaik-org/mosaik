import { type Accessor, createSignal, onCleanup } from "solid-js"
import { onPageStatusesChange, type PageStatus, pageStatuses } from "./statuses"

/** Every status the shell shows now (see {@link PageStatus}), kept live. */
export const usePageStatuses = (): Accessor<ReadonlyArray<PageStatus>> => {
  const [statuses, setStatuses] = createSignal(pageStatuses())
  onCleanup(onPageStatusesChange(setStatuses))
  return statuses
}
