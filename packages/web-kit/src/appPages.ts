import type { AnyApp } from "@mosaik/core"
import type { NavTabItem } from "./NavTabs"

/**
 * The pages of an app a person may see, as links (the app's pages in its manifest, `portal.pages`,
 * under its address). None for an app showing one page or none: there is nowhere else to go.
 */
export const appPageLinks = (app: AnyApp, can: (permission: string) => boolean): ReadonlyArray<NavTabItem> => {
  const links = (app.portal.pages ?? [])
    .filter((page) => page.permission === undefined || can(app.perm(page.permission)))
    .map((page) => ({
      label: page.title,
      to: page.path === "/" ? `/${app.id}` : `/${app.id}${page.path}`,
      // The first page holds the others: it is the active one only on its own address.
      exact: page.path === "/",
    }))
  return links.length > 1 ? links : []
}
