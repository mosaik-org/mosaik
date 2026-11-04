import type { StatusKey, StatusTone, StatusValue } from "@mosaik/core"

/**
 * The person's statuses and the work going on in this tab, as the shell shows them: beside places
 * in its navigation, and to the pages they concern, which show what waits there in their own way
 * (a filter of the things waiting, a note). The shell provides them; on a standalone page, there
 * are none.
 */
export interface PageStatus {
  /** `<app>:<name>`, as `app.status(name)` gives it (`busy:<n>` for work in this tab). */
  readonly key: string
  readonly description: string
  readonly value: StatusValue
  readonly tone: StatusTone
  /** Where it belongs in navigation: an app (`/sales`), one of its pages (`/sales/orders`) or Core's. */
  readonly path: string
  /** Where the things it is about are. */
  readonly link: string
}

let current: ReadonlyArray<PageStatus> = []
const listeners = new Set<(statuses: ReadonlyArray<PageStatus>) => void>()

/** Called by the shell whenever the person's statuses change. */
export const provideStatuses = (statuses: ReadonlyArray<PageStatus>): void => {
  current = statuses
  for (const listener of listeners) listener(current)
}

/** The person's statuses now; with `key`, those of one status (an app's own: `app.status(name)`). */
export const pageStatuses = (key?: StatusKey): ReadonlyArray<PageStatus> =>
  key === undefined ? current : current.filter((status) => status.key === key)

/** Calls `listener` when the person's statuses change; returns what stops it. */
export const onPageStatusesChange = (listener: (statuses: ReadonlyArray<PageStatus>) => void): (() => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
