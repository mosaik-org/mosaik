import { signIn, signOut, usePrincipal } from "@mosaik/auth/web"
import { useTheme } from "@mosaik/mosaik-ui"
import { AppIcon, type Command, useCommands } from "@mosaik/web-kit"
import { useQueryClient } from "@tanstack/solid-query"
import { useLocation, useNavigate, useRouter } from "@tanstack/solid-router"
import LayoutGrid from "lucide-solid/icons/layout-grid"
import LogIn from "lucide-solid/icons/log-in"
import LogOut from "lucide-solid/icons/log-out"
import Monitor from "lucide-solid/icons/monitor"
import Moon from "lucide-solid/icons/moon"
import Pin from "lucide-solid/icons/pin"
import PinOff from "lucide-solid/icons/pin-off"
import Sun from "lucide-solid/icons/sun"
import { appForPath } from "./apps"
import { routeTreeVersion } from "./routeTreeVersion"
import { useMyApps } from "./workspace/myApps"

/**
 * Commands every page has: navigation to every page the principal may open (from the
 * routes' `staticData.title`), pinning the current app, theme switching and signing in or out.
 */
export const useShellCommands = () => {
  const router = useRouter()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const principal = usePrincipal()
  const theme = useTheme()
  const location = useLocation()
  const apps = useMyApps()

  const pages = (): ReadonlyArray<Command> => {
    // Installed apps' routes join the tree when an app is first opened.
    routeTreeVersion()
    const all = Object.values(router.routesById).flatMap((route): ReadonlyArray<Command> => {
      const data = route.options.staticData
      const path = route.fullPath
      if (data?.title === undefined || path.includes("$")) return []
      const app = appForPath(path)
      if (app !== undefined && !principal().can(app.accessPermission)) return []
      if (data.permission !== undefined && !principal().can(data.permission)) return []
      return [
        {
          id: `page:${path}`,
          title: data.title,
          group: "Pages",
          hint: app?.name,
          keywords: [...(data.keywords ?? []), ...(app ? [app.name, app.description ?? ""] : [])],
          icon: app ? <AppIcon name={app.portal.icon} size={16} /> : <LayoutGrid size={16} />,
          ...(app === undefined ? {} : { app: { id: app.id, name: app.name } }),
          perform: () => navigate({ to: path }),
        },
      ]
    })
    // An installed app's `/<id>` stands in for its pages until it is loaded; then its own index page (`/<id>/`) wins.
    const byPath = new Map<string, Command>()
    for (const page of all) {
      const path = page.id.replace(/\/$/, "")
      if ((byPath.get(path)?.id.length ?? 0) < page.id.length) byPath.set(path, page)
    }
    // The overview first, then grouped by app.
    return [...byPath.values()].toSorted(
      (a, b) => (a.hint ?? "").localeCompare(b.hint ?? "") || a.title.localeCompare(b.title),
    )
  }

  const pinning = (): ReadonlyArray<Command> => {
    const app = appForPath(location().pathname)
    if (app === undefined || !apps.canPin() || !principal().can(app.accessPermission)) return []
    return [
      apps.isPinned(app.id)
        ? {
            id: "app:unpin",
            title: `Unpin ${app.name}`,
            group: "Actions",
            icon: <PinOff size={16} />,
            keywords: ["sidebar", "favorite"],
            perform: () => apps.unpin(app.id),
          }
        : {
            id: "app:pin",
            title: `Pin ${app.name}`,
            group: "Actions",
            icon: <Pin size={16} />,
            keywords: ["sidebar", "favorite"],
            perform: () => apps.pin(app.id),
          },
    ]
  }

  const actions = (): ReadonlyArray<Command> => [
    {
      id: "theme:light",
      title: "Use light theme",
      group: "Actions",
      icon: <Sun size={16} />,
      keywords: ["appearance"],
      perform: () => theme.setTheme("light"),
    },
    {
      id: "theme:dark",
      title: "Use dark theme",
      group: "Actions",
      icon: <Moon size={16} />,
      keywords: ["appearance"],
      perform: () => theme.setTheme("dark"),
    },
    {
      id: "theme:system",
      title: "Use system theme",
      group: "Actions",
      icon: <Monitor size={16} />,
      keywords: ["appearance"],
      perform: () => theme.setTheme("system"),
    },
    principal().isAuthenticated
      ? {
          id: "auth:sign-out",
          title: "Sign out",
          group: "Actions",
          icon: <LogOut size={16} />,
          perform: async () => {
            await signOut()
            queryClient.clear()
            await navigate({ to: "/" })
          },
        }
      : {
          id: "auth:sign-in",
          title: "Log in",
          group: "Actions",
          icon: <LogIn size={16} />,
          perform: () => signIn(),
        },
  ]

  useCommands(() => [...pages(), ...pinning(), ...actions()])
}
