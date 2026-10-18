import { usePrincipal } from "@mosaik/auth/web"
import { useRouter } from "@tanstack/solid-router"
import { onCleanup } from "solid-js"
import { appForPath } from "../apps"

/** A page the user visited, to jump back to it from the overview. */
export interface RecentPage {
  readonly path: string
  readonly title: string
  /** The app the page belongs to. */
  readonly app: string | undefined
}

const LIMIT = 8

/** Kept in the browser, per user: a convenience, not worth a server round trip per page. */
const storageKey = (user: string) => `mosaik-recent-pages:${user}`

export const readRecentPages = (user: string): ReadonlyArray<RecentPage> => {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(storageKey(user)) ?? "[]")
    return Array.isArray(value)
      ? value.filter(
          (page): page is RecentPage =>
            typeof page === "object" &&
            page !== null &&
            typeof page.path === "string" &&
            typeof page.title === "string",
        )
      : []
  } catch {
    return []
  }
}

const remember = (user: string, page: RecentPage) => {
  try {
    const pages = [page, ...readRecentPages(user).filter((recent) => recent.path !== page.path)].slice(0, LIMIT)
    localStorage.setItem(storageKey(user), JSON.stringify(pages))
  } catch {
    // Storage may be unavailable (private mode, quota): the list just stays as it was.
  }
}

/**
 * Remembers the pages a logged-in user visits: the deepest route with a title (the page a
 * detail view belongs to, e.g. "Orders" for `/sales/orders/42`). The overview is left out.
 */
export const useRecordPageVisits = () => {
  const router = useRouter()
  const principal = usePrincipal()
  const record = () => {
    const user = principal().user
    if (user === null) return
    const matches = router.state.matches
    // Pages that failed or do not exist are not worth going back to.
    if (matches.some((candidate) => candidate.status === "error" || candidate.status === "notFound")) return
    const match = matches.findLast((candidate) => candidate.staticData.title !== undefined)
    const title = match?.staticData.title
    const path = match?.pathname.replace(/(.)\/$/, "$1")
    if (title === undefined || path === undefined || path === "/") return
    const app = appForPath(path)
    // The shell explained that the user may not open it.
    if (app !== undefined && !principal().can(app.accessPermission)) return
    remember(user.id, { path, title, app: app?.id })
  }
  // The page the shell was loaded on resolved before this layout was there to listen.
  if (router.state.status === "idle") record()
  const unsubscribe = router.subscribe("onResolved", record)
  onCleanup(unsubscribe)
}
