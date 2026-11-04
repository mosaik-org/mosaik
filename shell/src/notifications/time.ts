/** Where a notification falls: today, yesterday, this week, or earlier. */
export type Day = "Today" | "Yesterday" | "Last 7 days" | "Earlier"

const DAY = 24 * 60 * 60 * 1000
const startOfDay = (ms: number) => {
  const date = new Date(ms)
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

/** Items (newest first) in runs by the day they came, as a list shows them under headings. */
export const groupByDay = <T>(
  items: ReadonlyArray<T>,
  timeOf: (item: T) => number,
  now: number,
): ReadonlyArray<{ readonly day: Day; readonly items: ReadonlyArray<T> }> => {
  const today = startOfDay(now)
  const dayOf = (item: T): Day => {
    const day = startOfDay(timeOf(item))
    if (day >= today) return "Today"
    if (day >= today - DAY) return "Yesterday"
    if (day >= today - 7 * DAY) return "Last 7 days"
    return "Earlier"
  }
  const groups: Array<{ day: Day; items: Array<T> }> = []
  for (const item of items) {
    const day = dayOf(item)
    const last = groups.at(-1)
    if (last?.day === day) last.items.push(item)
    else groups.push({ day, items: [item] })
  }
  return groups
}

/** How long ago, in a few characters for a list's edge: "now", "12m", "4h", "3d", then the date. */
export const shortAgo = (ms: number, now: number, locale?: string): string => {
  const minutes = Math.floor((now - ms) / 60_000)
  if (minutes < 1) return "now"
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d`
  return new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" }).format(ms)
}
