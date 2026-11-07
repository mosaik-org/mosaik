import type { PageStatus } from "@mosaik/client"
import { type StatusTone, statusSentence } from "@mosaik/core"

/**
 * What the shell's statuses come to at a place in navigation: which belong there, and the one mark
 * beside it. Pure, so where each goes and how it reads is tested.
 */

/** The statuses of a place: at its path, and with `below`, at the places under it too. */
export const statusesAt = (
  statuses: ReadonlyArray<PageStatus>,
  path: string,
  options: { readonly below: boolean },
): ReadonlyArray<PageStatus> =>
  statuses.filter((status) => status.path === path || (options.below && status.path.startsWith(`${path}/`)))

/** What the statuses of a place come to, for the one mark beside it. */
export interface StatusSummary {
  /** Things waiting, added up. */
  readonly count: number
  /** Work running (the server's, or a tab's). */
  readonly running: boolean
  /** Something new. */
  readonly fresh: boolean
  /** How much it asks for attention: the strongest tone among what it says. */
  readonly tone: StatusTone
  /** What each says, for reading it out and on hover. */
  readonly lines: ReadonlyArray<string>
}

const toneRank: Record<StatusTone, number> = { attention: 0, warning: 1, danger: 2 }

export const summarize = (statuses: ReadonlyArray<PageStatus>): StatusSummary => ({
  count: statuses.reduce((sum, status) => sum + (status.value._tag === "count" ? status.value.count : 0), 0),
  running: statuses.some((status) => status.value._tag === "running"),
  fresh: statuses.some((status) => status.value._tag === "new"),
  tone: statuses.reduce<StatusTone>(
    (strongest, status) => (toneRank[status.tone] > toneRank[strongest] ? status.tone : strongest),
    "attention",
  ),
  lines: statuses.map(statusSentence),
})

/** Whether a summary has anything to show. */
export const isQuiet = (summary: StatusSummary): boolean => summary.lines.length === 0
