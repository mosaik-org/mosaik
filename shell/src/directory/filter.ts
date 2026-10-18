/** Where an app is listed when neither it nor an admin chose a category. */
export const DEFAULT_CATEGORY = "Other"

/** An app as the directory lists it. */
export interface DirectoryApp {
  readonly id: string
  readonly name: string
  readonly description: string | undefined
  readonly category: string
  /** Whether the user may open it. */
  readonly available: boolean
  /** People who used it lately. */
  readonly activeUsers: number
}

export type DirectorySort = "name" | "popular"

export interface DirectoryFilter {
  readonly query: string
  readonly category: string | undefined
  readonly availableOnly: boolean
}

const searchable = (app: DirectoryApp) => `${app.name} ${app.id} ${app.category} ${app.description ?? ""}`.toLowerCase()

/** Apps matching every word of the query, in the category, and open to the user if asked. */
export const filterApps = (apps: ReadonlyArray<DirectoryApp>, filter: DirectoryFilter): ReadonlyArray<DirectoryApp> => {
  const words = filter.query.toLowerCase().split(/\s+/).filter(Boolean)
  return apps.filter(
    (app) =>
      (filter.category === undefined || app.category === filter.category) &&
      (!filter.availableOnly || app.available) &&
      words.every((word) => searchable(app).includes(word)),
  )
}

const byName = (a: DirectoryApp, b: DirectoryApp) => a.name.localeCompare(b.name)

export const sortApps = (apps: ReadonlyArray<DirectoryApp>, sort: DirectorySort): ReadonlyArray<DirectoryApp> =>
  apps.toSorted(sort === "popular" ? (a, b) => b.activeUsers - a.activeUsers || byName(a, b) : byName)

/** Categories by name, with the default one last. */
const byCategory = (a: string, b: string) =>
  Number(a === DEFAULT_CATEGORY) - Number(b === DEFAULT_CATEGORY) || a.localeCompare(b)

/** The apps of each category, keeping the apps' order. */
export const groupByCategory = (
  apps: ReadonlyArray<DirectoryApp>,
): ReadonlyArray<{ readonly category: string; readonly apps: ReadonlyArray<DirectoryApp> }> => {
  const groups = new Map<string, Array<DirectoryApp>>()
  for (const app of apps) groups.set(app.category, [...(groups.get(app.category) ?? []), app])
  return [...groups.keys()].toSorted(byCategory).map((category) => ({ category, apps: groups.get(category) ?? [] }))
}

/** Every category with how many apps it has. */
export const categoryCounts = (
  apps: ReadonlyArray<DirectoryApp>,
): ReadonlyArray<{ readonly category: string; readonly count: number }> =>
  groupByCategory(apps).map((group) => ({ category: group.category, count: group.apps.length }))
