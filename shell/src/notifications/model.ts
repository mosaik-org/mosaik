import type { InboxItem, InboxKind, InboxState } from "@mosaik/notifications/contract"
import { Schema } from "effect"
import { untilLabel } from "./snooze"
import { groupByDay } from "./time"

/**
 * The inbox's lists: what is open, split into what asks something of the person and what is only for
 * them to know, then what they put away and what is handled.
 */
export const InboxView = Schema.Literals(["todo", "updates", "snoozed", "resolved"])
export type InboxView = typeof InboxView.Type

export interface ViewDefinition {
  readonly label: string
  readonly state: InboxState
  readonly kind?: InboxKind
  readonly empty: { readonly title: string; readonly description: string }
}

export const VIEWS: Readonly<Record<InboxView, ViewDefinition>> = {
  todo: {
    label: "To do",
    state: "open",
    kind: "action",
    empty: { title: "Nothing to do", description: "What apps ask of you comes here, and leaves once it is done." },
  },
  updates: {
    label: "Updates",
    state: "open",
    kind: "information",
    empty: { title: "You're all caught up", description: "What apps want you to know comes here." },
  },
  snoozed: {
    label: "Snoozed",
    state: "snoozed",
    empty: { title: "Nothing snoozed", description: "What you put away comes back, unread, when its time comes." },
  },
  resolved: {
    label: "Resolved",
    state: "resolved",
    empty: { title: "Nothing resolved lately", description: "Resolved items stay here for 30 days." },
  },
}

/** Which list an item is in. */
export const viewOf = (item: InboxItem): InboxView =>
  item.state === "open" ? (item.action ? "todo" : "updates") : item.state

/** Open and critical: what goes before everything else, whenever it came. */
export const isCritical = (item: InboxItem) => item.state === "open" && item.content.severity === "critical"

export const isUnread = (item: InboxItem) => item.readAt === null && item.state === "open"

/** When the item last changed where it is: its newest notification, or its resolution. */
export const timeOf = (item: InboxItem) => (item.resolution?.at ?? item.updatedAt).epochMilliseconds

export interface Section {
  readonly heading: string
  readonly items: ReadonlyArray<InboxItem>
}

/**
 * How a list is divided: open items into what needs the person and what is only for them to know
 * (`kind`, where both are shown together, as in the bell), or by the day they last changed (`day`),
 * critical ones first.
 */
export type Grouping = "kind" | "day"

/** An item list's sections, in the order shown. */
export const sectionsOf = (
  items: ReadonlyArray<InboxItem>,
  grouping: Grouping,
  now: number,
): ReadonlyArray<Section> => {
  if (grouping === "kind") {
    return [
      { heading: "To do", items: items.filter((item) => item.action) },
      { heading: "For your information", items: items.filter((item) => !item.action) },
    ].filter((section) => section.items.length > 0)
  }
  // The list's pages come newest first; what is critical is lifted out of them, among what is loaded.
  const critical = items.filter(isCritical)
  const rest = items.filter((item) => !isCritical(item))
  return [
    ...(critical.length > 0 ? [{ heading: "Critical", items: critical }] : []),
    ...groupByDay(rest, timeOf, now).map((group) => ({ heading: group.day, items: group.items })),
  ]
}

/** The items in the order the sections show them, which moving through the list by keyboard follows. */
export const inListOrder = (sections: ReadonlyArray<Section>): ReadonlyArray<InboxItem> =>
  sections.flatMap((section) => section.items)

/** "Resolve" for what asked for action, "Done" for information. */
export const resolveLabel = (item: InboxItem) => (item.action ? "Resolve" : "Done")

/** Where an item stands, beyond being open: snoozed until when, or resolved by whom. */
export const statusOf = (item: InboxItem, appName: string, now: number): string | undefined => {
  if (item.state === "snoozed" && item.snoozedUntil !== null) {
    return `Back ${untilLabel(new Date(item.snoozedUntil.epochMilliseconds), new Date(now))}`
  }
  const resolution = item.resolution
  if (resolution === null) return undefined
  if (!resolution.app) return item.action ? "Resolved by you" : "Done"
  return resolution.by === null ? `Resolved in ${appName}` : `Resolved by ${resolution.by.name}`
}

/** A body's paragraphs, which blank lines separate. */
export const paragraphs = (body: string | undefined): ReadonlyArray<string> =>
  (body ?? "")
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0)

/**
 * Items that came or changed since a list was first shown, and not yet seen: what slides in as it
 * arrives. A page of older items loaded later came before, so it does not; nor does a list's first
 * showing.
 */
export const createArrivals = (shownAt: number) => {
  const seen = new Map<number, number>()
  return (items: ReadonlyArray<InboxItem>): ReadonlySet<number> => {
    const arrived = new Set<number>()
    for (const item of items) {
      const at = item.updatedAt.epochMilliseconds
      if (at > shownAt && seen.get(item.id) !== at) arrived.add(item.id)
      seen.set(item.id, at)
    }
    return arrived
  }
}
