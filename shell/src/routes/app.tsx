import { sessionQueryOptions, useLiveAccess, usePrincipal } from "@mosaik/auth/web"
import { Button } from "@mosaik/ui"
import { AccessDenied, CommandProvider, type SearchSource } from "@mosaik/web-kit"
import { useQueryClient } from "@tanstack/solid-query"
import { createFileRoute, Link, Outlet, redirect, useLocation } from "@tanstack/solid-router"
import { Show } from "solid-js"
import { allApps, appForPath } from "../apps"
import { builtinSearchSources } from "../builtinSearch"
import { useShellCommands } from "../commands"
import { AppShell } from "../components/AppShell"
import { installedSearchSources } from "../installedSearch"
import { useMyApps, useRecordAppOpens } from "../workspace/myApps"
import { workspaceKeys } from "../workspace/queries"
import { useRecordPageVisits } from "../workspace/recentPages"

const ShellCommands = () => {
  useShellCommands()
  return null
}

/**
 * Layout for every page except login. Enforces app access centrally, so an
 * app cannot forget it: visitors without access are sent to the login page,
 * logged-in users without the permission see an explanation.
 */
export const Route = createFileRoute("/_app")({
  beforeLoad: async ({ context, location }) => {
    const { principal } = await context.queryClient.ensureQueryData(sessionQueryOptions())
    const app = appForPath(location.pathname)
    if (app !== undefined && !principal.can(app.accessPermission) && !principal.isAuthenticated) {
      throw redirect({ to: "/login", search: { redirect: location.href } })
    }
  },
  component: ShellLayout,
})

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
                    <Link to="/directory/$app" params={{ app: app().id }}>
                      <Button>Ask for access</Button>
                    </Link>
                  }
                />
              )}
            </Show>
          }
        >
          <Outlet />
        </Show>
      </AppShell>
    </CommandProvider>
  )
}
