import { signInUrl } from "@mosaik/auth/contract"
import { sessionQueryOptions, useLiveAccess, usePrincipal } from "@mosaik/auth/web"
import { type ConsoleExtensions, ConsoleExtensionsProvider } from "@mosaik/console"
import { AccessDenied, CommandProvider, type SearchSource } from "@mosaik/frame"
import { Button } from "@mosaik/ui"
import { useQueryClient } from "@tanstack/solid-query"
import { createFileRoute, Link, Outlet, redirect, useLocation } from "@tanstack/solid-router"
import { Show } from "solid-js"
import { allApps, appForPath } from "../apps"
import { builtinSearchSources } from "../builtinSearch"
import { useShellCommands } from "../commands"
import { AppShell } from "../components/AppShell"
import { portalAppTab } from "../directory/PortalTab"
import { installedSearchSources } from "../installedSearch"
import { useMyApps, useRecordAppOpens } from "../workspace/myApps"
import { workspaceKeys } from "../workspace/queries"
import { useRecordPageVisits } from "../workspace/recentPages"

const ShellCommands = () => {
  useShellCommands()
  return null
}

/**
 * Layout for every page. Enforces app access centrally, so an app cannot forget it:
 * visitors without access are sent to Core's sign-in page, logged-in users without the
 * permission see an explanation.
 */
export const Route = createFileRoute("/_app")({
  beforeLoad: async ({ context, location }) => {
    const { principal } = await context.queryClient.ensureQueryData(sessionQueryOptions())
    const app = appForPath(location.pathname)
    if (app !== undefined && !principal.can(app.accessPermission) && !principal.isAuthenticated) {
      throw redirect({ href: signInUrl(location.href), reloadDocument: true })
    }
  },
  component: ShellLayout,
})

/** The Portal's parts of Core's console pages. */
const extensions: ConsoleExtensions = { appTabs: [portalAppTab] }

function ShellLayout() {
  const principal = usePrincipal()
  const location = useLocation()
  const apps = useMyApps()
  const queryClient = useQueryClient()
  // What someone can open and answer follows their access (closed requests, new members).
  useLiveAccess(() => {
    void queryClient.invalidateQueries({ queryKey: workspaceKeys.all })
    void queryClient.invalidateQueries({ queryKey: ["access"] })
  })
  useRecordAppOpens()
  useRecordPageVisits()

  const current = () => appForPath(location().pathname)
  const required = () => current()?.accessPermission
  const allowed = () => {
    const permission = required()
    return permission === undefined || principal().can(permission)
  }
  // Providers are only loaded for principals who may open the app.
  const searchSources = (): ReadonlyArray<SearchSource> =>
    [...builtinSearchSources, ...installedSearchSources].filter((source) => {
      const app = allApps.find((candidate) => candidate.id === source.app)
      return app !== undefined && principal().can(app.accessPermission)
    })
  // The app the user is in counts as one they use.
  const affinity = (app: string) => (app === current()?.id ? 1 : apps.affinity(app))

  return (
    <CommandProvider sources={searchSources()} affinity={affinity}>
      <ShellCommands />
      <AppShell>
        <Show
          when={allowed()}
          fallback={
            <Show when={current()} fallback={<AccessDenied />}>
              {(app) => (
                <AccessDenied
                  description={`Ask for access on ${app().name}'s page: its owners decide who can use it.`}
                  action={
                    <Button
                      asChild={(link) => (
                        <Link to="/directory/$app" params={{ app: app().id }} {...link()}>
                          Ask for access
                        </Link>
                      )}
                    />
                  }
                />
              )}
            </Show>
          }
        >
          <ConsoleExtensionsProvider value={extensions}>
            <Outlet />
          </ConsoleExtensionsProvider>
        </Show>
      </AppShell>
    </CommandProvider>
  )
}
