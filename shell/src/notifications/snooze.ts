/** When the working day starts, for "tomorrow" and "next week". */
const MORNING = 9

const at = (date: Date, days: number, hour: number) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + days, hour, 0, 0, 0)

export interface SnoozeChoice {
  readonly id: "hour" | "tomorrow" | "week"
  readonly label: string
  readonly until: Date
}

/**
 * When an item can come back, in the person's own time: in an hour, tomorrow morning, or next Monday
 * morning. Tomorrow is what "later" means most of the time, so it is the default (`H`).
 */
export const snoozeChoices = (now: Date): ReadonlyArray<SnoozeChoice> => {
  // Monday is 1; from Monday itself, next Monday is a week away.
  const toMonday = (8 - now.getDay()) % 7 || 7
  return [
    { id: "hour", label: "In an hour", until: new Date(now.getTime() + 60 * 60 * 1000) },
    { id: "tomorrow", label: "Tomorrow", until: at(now, 1, MORNING) },
    { id: "week", label: "Next week", until: at(now, toMonday, MORNING) },
  ]
}

/** When a snoozed item comes back, as short as is clear: "9:00", "tomorrow 9:00", "Mon 9:00", "12 Nov". */
export const untilLabel = (until: Date, now: Date, locale?: string): string => {
  const time = until.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" })
  const days = Math.round((at(until, 0, 0).getTime() - at(now, 0, 0).getTime()) / (24 * 60 * 60 * 1000))
  if (days <= 0) return time
  if (days === 1) return `tomorrow ${time}`
  if (days < 7) return `${until.toLocaleDateString(locale, { weekday: "short" })} ${time}`
  return until.toLocaleDateString(locale, { day: "numeric", month: "short" })
}
