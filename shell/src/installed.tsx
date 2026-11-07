import { sessionQueryOptions } from "@mosaik/auth/web"
import { type AnyApp, defineApp, isAppColor } from "@mosaik/core"
import { type SearchProvider, withTimeout } from "@mosaik/frame"
import type { Catalog, PublicApp } from "@mosaik/portal/contract"
import type { WebApp } from "@mosaik/portal/web"
import { type AnyRoute, createRoute, notFound, Outlet, redirect } from "@tanstack/solid-router"
import { Dynamic } from "solid-js/web"
import { addInstalledApps, builtinIds, setCategoryOverrides } from "./apps"
import { AppLoadError } from "./components/AppError"
import { installedSearchSources } from "./installedSearch"
import { portalApi } from "./portalApi"
import { getRouter } from "./router"
import { Route as ShellLayout } from "./routes/app"
import { setRouteTreeVersion } from "./routeTreeVersion"

const fetchCatalog = () => portalApi((client) => client.catalog.apps())

/** How long the shell waits for an app's styles before showing it anyway. */
const STYLES_TIMEOUT_MS = 3000

/** How long the shell waits for an app's entry module. */
const ENTRY_TIMEOUT_MS = 15_000

/** An installed app in the shell. Its code loads the first time someone who may open it goes there. */
interface InstalledApp {
  /** Replaced when the app turns out to have been updated since the shell started. */
  info: PublicApp
  /** How the shell knows it, like a built-in app's manifest. */
  readonly manifest: AnyApp
  /** Mounted at `/<id>`; its children are the placeholder until the app is loaded. */
  readonly layout: AnyRoute
  /** Index and catch-all routes under `/<id>`: the app loads through them, and after that they are "not found". */
  readonly placeholders: ReadonlyArray<AnyRoute>
  definition: WebApp | undefined
  loading: Promise<void> | undefined
  failed: boolean
}

/**
 * Shell-side description of an installed app, so navigation and the route guard treat it like a
 * built-in one. Its permissions are the ones the shell checks: opening it, and seeing its pages.
 */
const toApp = (app: PublicApp): AnyApp => {
  const access = app.access.slice(app.access.indexOf(":") + 1)
  const pages = app.pages.map(({ title, path, permission }) =>
    permission === null ? { title, path } : { title, path, permission },
  )
  const permissions = [access, ...pages.flatMap((page) => (page.permission === undefined ? [] : [page.permission]))]
  return defineApp({
    id: app.id,
    name: app.name,
    ...(app.description === null ? {} : { description: app.description }),
    version: app.version,
    access,
    permissions: Object.fromEntries(permissions.map((name) => [name, { description: "" }])),
    portal: {
      ...(app.icon === null ? {} : { icon: app.icon }),
      ...(isAppColor(app.color) ? { color: app.color } : {}),
      ...(app.category === null ? {} : { category: app.category }),
      pages,
    },
  })
}

const appUrl = (app: PublicApp, file: string) => `/apps/${app.id}/${file}`

const loadStyles = (app: PublicApp) =>
  Promise.all(
    app.web.styles.map(
      (file) =>
        new Promise<void>((resolve) => {
          const href = appUrl(app, file)
          if (document.head.querySelector(`link[data-app="${app.id}"][href="${href}"]`) !== null) return resolve()
          const link = document.createElement("link")
          link.rel = "stylesheet"
          link.href = href
          link.dataset.app = app.id
          link.onload = () => resolve()
          link.onerror = () => resolve()
          document.head.append(link)
          setTimeout(resolve, STYLES_TIMEOUT_MS)
        }),
    ),
  )

/** After a failure the URL changes, since a browser may keep a failed import's result. */
const importEntry = async (app: PublicApp, retry: boolean): Promise<WebApp> => {
  const url = appUrl(app, app.web.entry) + (retry ? `?attempt=${Date.now()}` : "")
  const module: { default?: WebApp } = await withTimeout(
    import(/* @vite-ignore */ url),
    ENTRY_TIMEOUT_MS,
    "It did not answer in time.",
  )
  if (typeof module.default?.routes !== "function") throw new Error("Its bundle does not export defineWebApp(...)")
  return module.default
}

const load = async (app: InstalledApp): Promise<WebApp> => {
  try {
    const [definition] = await Promise.all([importEntry(app.info, app.failed), loadStyles(app.info)])
    return definition
  } catch (error) {
    // The app may have been updated since the shell started: the files it was known by are gone.
    const current = (await fetchCatalog().catch(() => undefined))?.apps.find(
      (candidate) => candidate.id === app.info.id,
    )
    if (current === undefined || current.web.entry === app.info.web.entry) throw error
    app.info = current
    const [definition] = await Promise.all([importEntry(current, false), loadStyles(current)])
    return definition
  }
}

const pathOf = (route: AnyRoute) => (route.options as { path?: string }).path?.replace(/^\/(?=.)/, "")

/** Replaces the placeholders with the app's routes, keeping each for the paths the app does not cover. */
const mount = (app: InstalledApp, definition: WebApp) => {
  const routes = definition.routes(app.layout)
  const paths = new Set(routes.map(pathOf))
  app.layout.addChildren([...routes, ...app.placeholders.filter((placeholder) => !paths.has(pathOf(placeholder)))])
  app.definition = definition
  const router = getRouter()
  router.setRoutes(router.buildRouteTree())
  setRouteTreeVersion((version) => version + 1)
}

/** Loads the app once; after a failure, the next navigation tries again. */
const ensureLoaded = (app: InstalledApp): Promise<void> => {
  app.loading ??= load(app)
    .then((definition) => mount(app, definition))
    .catch((error: unknown) => {
      app.loading = undefined
      app.failed = true
      throw new AppLoadError(app.info.name, error)
    })
  return app.loading
}

const register = (info: PublicApp): InstalledApp => {
  const manifest = toApp(info)
  const layout = createRoute({
    getParentRoute: () => ShellLayout,
    path: info.id,
    // Listed in the command palette before the app is loaded (its pages join once it is).
    staticData: { title: info.name },
    beforeLoad: async ({ context, location }) => {
      if (app.definition !== undefined) return
      // Without access the shell explains why, and the app is not loaded.
      const { principal } = await context.queryClient.ensureQueryData(sessionQueryOptions())
      if (!principal.can(manifest.accessPermission)) return
      await ensureLoaded(app)
      // This navigation was matched before the app's routes existed: match it again.
      throw redirect({ href: location.href, replace: true })
    },
    component: () => <Dynamic component={app.definition?.component ?? Outlet} />,
  })
  // `/<id>` and everything under it, until the app's own routes take over.
  const placeholders = ["/", "$"].map((path) => {
    const placeholder: AnyRoute = createRoute({
      getParentRoute: () => layout,
      path,
      beforeLoad: ({ location }) => {
        if (app.definition === undefined) return
        // Matched while another navigation (a preload on hover) was loading the app.
        const [, , found] = getRouter().getMatchedRoutes(location.pathname)
        if (found !== placeholder) throw redirect({ href: location.href, replace: true })
        throw notFound()
      },
    })
    return placeholder
  })
  layout.addChildren(placeholders)
  const app: InstalledApp = {
    info,
    manifest,
    layout,
    placeholders,
    definition: undefined,
    loading: undefined,
    failed: false,
  }
  return app
}

const importSearch = async (app: InstalledApp): Promise<SearchProvider> => {
  const file = app.info.web.search
  if (file === null) throw new Error(`${app.info.name} has no search`)
  const module: { default?: SearchProvider } = await import(/* @vite-ignore */ appUrl(app.info, file))
  if (typeof module.default?.search !== "function") {
    throw new Error(`${app.info.name}: web/search.ts does not export defineSearchProvider(...)`)
  }
  return module.default
}

/**
 * Registers installed apps before the router is created: their metadata (navigation and
 * access checks) and a placeholder route each. An app's code and styles load the first
 * time someone who may open it goes there, or hovers a link to it (the router preloads).
 */
export const registerInstalledApps = async (): Promise<void> => {
  const catalog = await fetchCatalog().catch((error: unknown): Pick<Catalog, "apps" | "categories"> => {
    console.error("Could not load installed apps", error)
    return { apps: [], categories: {} }
  })
  setCategoryOverrides(catalog.categories)
  const installed = catalog.apps.filter((app) => !builtinIds.has(app.id)).map(register)
  addInstalledApps(installed.map((app) => app.manifest))
  for (const app of installed) {
    if (app.info.web.search !== null) {
      installedSearchSources.push({ app: app.info.id, load: () => importSearch(app) })
    }
  }
  // The file-based route tree is built already; installed apps join the main layout.
  ;(ShellLayout as unknown as { children: Array<AnyRoute> }).children.push(...installed.map((app) => app.layout))
}
