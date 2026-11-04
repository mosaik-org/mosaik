import type { BusyMark, PageStatus } from "@mosaik/client"
import type { PersonStatus } from "@mosaik/platform/contract"

/**
 * What the shell shows beside places in its navigation, from what it receives: the person's
 * statuses (from apps and Core) and the work going on in this tab, as `PageStatus`es.
 */

/** A status as the shell shows it. */
export const fromStatus = ({ key, description, value, tone, path, link }: PersonStatus): PageStatus => ({
  key,
  description,
  value,
  tone,
  path,
  link,
})

/** Work in this tab, shown like work running. */
export const fromBusy = (mark: BusyMark): PageStatus => ({
  key: `busy:${mark.id}`,
  description: mark.label,
  path: mark.path,
  link: mark.path,
  tone: "attention",
  value: { _tag: "running", progress: null, label: mark.label },
})

/**
 * Whether a status still has something to say: something new only until the person opens the app
 * after it came (`lastOpened`: epoch milliseconds, `undefined` if never).
 */
export const isCurrent = (status: PersonStatus, lastOpened: (app: string) => number | undefined): boolean => {
  if (status.value._tag !== "new" || status.app === null) return true
  const opened = lastOpened(status.app)
  return opened === undefined || status.value.at.epochMilliseconds > opened
}

/** A status's link as the router takes it: the path, and its search (a link may filter the page). */
export const linkTarget = (link: string): { readonly to: string; readonly search: Record<string, string> } => {
  const url = new URL(link, "http://mosaik")
  return { to: url.pathname, search: Object.fromEntries(url.searchParams) }
}

/** What waits for the person everywhere, for the tab's title. */
export const waitingCount = (statuses: ReadonlyArray<PageStatus>): number =>
  statuses.reduce((sum, status) => sum + (status.value._tag === "count" ? status.value.count : 0), 0)
