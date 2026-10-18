/** How often and when a user last opened an app (epoch milliseconds). */
export interface Usage {
  readonly app: string
  readonly opens: number
  readonly lastOpenedAt: number
}

const DAY_MS = 24 * 60 * 60 * 1000

/** After a week without opening an app, its recency counts half. */
const RECENCY_HALF_LIFE_DAYS = 7

/** Used apps stay below pinned ones. */
const MAX_USED_AFFINITY = 0.9

/**
 * How much a user uses each app, from 0 (never opened) to 1 (pinned): recency (halving
 * every week) and frequency (opens, on a log scale against their most opened app).
 */
export const affinities = (
  pinned: ReadonlyArray<string>,
  usage: ReadonlyArray<Usage>,
  now: number,
): ReadonlyMap<string, number> => {
  const result = new Map<string, number>()
  const mostOpens = Math.max(1, ...usage.map((entry) => entry.opens))
  for (const entry of usage) {
    const days = Math.max(0, now - entry.lastOpenedAt) / DAY_MS
    const recency = 0.5 ** (days / RECENCY_HALF_LIFE_DAYS)
    const frequency = Math.log1p(entry.opens) / Math.log1p(mostOpens)
    result.set(entry.app, MAX_USED_AFFINITY * (0.6 * recency + 0.4 * frequency))
  }
  for (const app of pinned) result.set(app, 1)
  return result
}

/** The most recently opened apps, leaving out the given ones (e.g. pinned). */
export const recentApps = (
  usage: ReadonlyArray<Usage>,
  exclude: ReadonlySet<string>,
  limit: number,
): ReadonlyArray<string> =>
  usage
    .filter((entry) => !exclude.has(entry.app))
    .toSorted((a, b) => b.lastOpenedAt - a.lastOpenedAt)
    .slice(0, limit)
    .map((entry) => entry.app)

/** Moves an item by `offset` places, staying within the list. */
export const move = <A>(list: ReadonlyArray<A>, item: A, offset: number): ReadonlyArray<A> => {
  const from = list.indexOf(item)
  if (from === -1) return list
  const to = Math.min(list.length - 1, Math.max(0, from + offset))
  const next = list.filter((candidate) => candidate !== item)
  next.splice(to, 0, item)
  return next
}
