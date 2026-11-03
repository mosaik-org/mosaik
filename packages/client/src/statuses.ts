import type { StatusKey, StatusValue } from "@mosaik/core"

/**
 * The person's statuses, for the pages they concern: an app's page shows what waits for the person
 * there (a filter of the things waiting, a note), in its own way. The shell provides them; on a
 * standalone page, there are none.
 */
export interface PageStatus {
  /** `<app>:<name>`, as `app.status(name)` gives it. */
  readonly key: string
  readonly description: string
  readonly value: StatusValue
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
