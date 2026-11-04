import { type AnyApp, isApp } from "@mosaik/core"
import { createSignal } from "solid-js"
import { DEFAULT_CATEGORY } from "./directory/filter"

/** Built-in apps, discovered at build time from `apps/<id>/manifest.ts`. */
const modules = import.meta.glob<{ default: unknown }>("../../apps/*/manifest.ts", { eager: true })

const builtin: ReadonlyArray<AnyApp> = Object.values(modules).map((module) => {
  if (!isApp(module.default)) throw new Error("An app manifest must default-export defineApp(...)")
  return module.default
})

/**
 * Every app in the shell: built-in apps plus the installed apps from the catalog
 * ({@link addInstalledApps}, called before the router is created; their code loads later).
 */
export let allApps: ReadonlyArray<AnyApp> = sortByName(builtin)

/** Ids of built-in apps (installed apps cannot replace them). */
export const builtinIds: ReadonlySet<string> = new Set(builtin.map((app) => app.id))

export const addInstalledApps = (apps: ReadonlyArray<AnyApp>): void => {
  allApps = sortByName([...builtin, ...apps.filter((app) => !builtinIds.has(app.id))])
}

function sortByName(list: ReadonlyArray<AnyApp>): ReadonlyArray<AnyApp> {
  return [...list].sort((a, b) => a.name.localeCompare(b.name))
}

/** The app owning a URL path (`/sales/orders` → sales). */
export const appForPath = (pathname: string): AnyApp | undefined => {
  const segment = pathname.split("/")[1]
  return allApps.find((app) => app.id === segment)
}

/** Where an app is mounted in the shell. */
export const appHref = (app: AnyApp): string => `/${app.id}`

/** Categories admins chose, by app id (from the catalog). */
const [categoryOverrides, setCategoryOverrides] = createSignal<Readonly<Record<string, string>>>({})

export { setCategoryOverrides }

/** After an admin changed a category (`null`: back to the app's own). */
export const setCategoryOverride = (id: string, category: string | null): void => {
  setCategoryOverrides(({ [id]: _, ...others }) => (category === null ? others : { ...others, [id]: category }))
}

/** Where the app directory lists an app: the admins' choice, else the app's own. */
export const categoryOf = (app: AnyApp): string =>
  categoryOverrides()[app.id] ?? app.portal.category ?? DEFAULT_CATEGORY

/** Who sent a notification: an app, or the platform itself. */
/** The app a notification or status comes from, by its id (`platform` is Mosaik's own: none). */
export const sourceApp = (id: string): AnyApp | undefined => allApps.find((app) => app.id === id)

export const sourceName = (id: string): string =>
  id === "platform" ? "Mosaik" : (allApps.find((app) => app.id === id)?.name ?? id)
