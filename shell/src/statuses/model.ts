import type { BusyMark } from "@mosaik/client"
import type { StatusTone, StatusValue } from "@mosaik/core"
import { type PersonStatus, statusSentence } from "@mosaik/platform/contract"

/**
 * What the shell shows beside places in its navigation: the person's statuses (from apps and
 * Core) and the work going on in this tab. Pure, so where each goes and how it reads is tested.
 */
export interface ShownStatus {
  readonly key: string
  /** What it is about, e.g. "Orders waiting for approval". */
  readonly description: string
  /** Where it belongs in the shell: an app, one of its pages, or one of Core's. */
  readonly path: string
  /** Where the things it is about are: its path, or a narrower view (a filter, one item). */
  readonly link: string
  readonly tone: StatusTone
  readonly value: StatusValue
}

/** Work in this tab, shown like work running. */
export const fromBusy = (mark: BusyMark): ShownStatus => ({
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

/** The statuses of a place: at its path, and with `below`, at the places under it too. */
export const statusesAt = (
  statuses: ReadonlyArray<ShownStatus>,
  path: string,
  options: { readonly below: boolean },
): ReadonlyArray<ShownStatus> =>
  statuses.filter((status) => status.path === path || (options.below && status.path.startsWith(`${path}/`)))

/** A status's link as the router takes it: the path, and its search (a link may filter the page). */
export const linkTarget = (link: string): { readonly to: string; readonly search: Record<string, string> } => {
  const url = new URL(link, "http://mosaik")
  return { to: url.pathname, search: Object.fromEntries(url.searchParams) }
}

/** What the statuses of a place come to, for the one mark beside it. */
export interface StatusSummary {
  /** Things waiting, added up. */
  readonly count: number
  /** Work running (the server's, or this tab's). */
  readonly running: boolean
  /** Something new. */
  readonly fresh: boolean
  /** How much it asks for attention: the strongest tone among what it says. */
  readonly tone: StatusTone
  /** What each says, for reading it out and on hover. */
  readonly lines: ReadonlyArray<string>
}

const toneRank: Record<StatusTone, number> = { attention: 0, warning: 1, danger: 2 }

/** One sentence for a status, e.g. "Orders waiting for approval: 3" or "Importing orders (40%)". */
export const describe = (status: ShownStatus): string => statusSentence(status)

export const summarize = (statuses: ReadonlyArray<ShownStatus>): StatusSummary => ({
  count: statuses.reduce((sum, status) => sum + (status.value._tag === "count" ? status.value.count : 0), 0),
  running: statuses.some((status) => status.value._tag === "running"),
  fresh: statuses.some((status) => status.value._tag === "new"),
  tone: statuses.reduce<StatusTone>(
    (strongest, status) => (toneRank[status.tone] > toneRank[strongest] ? status.tone : strongest),
    "attention",
  ),
  lines: statuses.map(describe),
})

/** Whether a summary has anything to show. */
export const isQuiet = (summary: StatusSummary): boolean => summary.lines.length === 0

/** What waits for the person everywhere, for the tab's title. */
export const waitingCount = (statuses: ReadonlyArray<ShownStatus>): number => summarize(statuses).count
