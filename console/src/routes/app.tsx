import { AGENT_CONNECTIONS_PATH, signInUrl } from "@mosaik/auth/contract"
import { sessionQueryOptions, signOut, useLiveAccess, usePrincipal } from "@mosaik/auth/web"
import { canUseConsole, consoleNav } from "@mosaik/console"
import { Button, EmptyState, ThemeToggle } from "@mosaik/mosaik-ui"
import { css } from "@mosaik/styled-system/css"
import { CommandProvider, PageMain } from "@mosaik/web-kit"
import { useQueryClient } from "@tanstack/solid-query"
import { createFileRoute, Link, Outlet, redirect } from "@tanstack/solid-router"
import Lock from "lucide-solid/icons/lock"
import { For, Show } from "solid-js"

/**
 * The console's frame: who may use it (admins, and app owners for their apps), and its
 * sections. Visitors go to Core's sign-in page first.
 */
export const Route = createFileRoute("/_app")({
  beforeLoad: async ({ context, location }) => {
    const { principal } = await context.queryClient.ensureQueryData(sessionQueryOptions())
    if (!principal.isAuthenticated) throw redirect({ href: signInUrl(location.href), reloadDocument: true })
  },
  component: ConsoleLayout,
})

const styles = {
  header: css({
    display: "flex",
    alignItems: "center",
    gap: "6",
    px: { base: "4", md: "6" },
    py: "3",
    borderBottomWidth: "1px",
    borderColor: "border",
    bg: "canvas",
  }),
  brand: css({ display: "flex", alignItems: "center", gap: "2", fontWeight: "semibold" }),
  mark: css({
    display: "grid",
    placeItems: "center",
    width: "7",
    height: "7",
    borderRadius: "md",
    bg: "accent.solid.bg",
    color: "accent.solid.fg",
    fontSize: "sm",
  }),
  nav: css({ display: "flex", gap: "4", flex: "1", fontSize: "sm" }),
  link: css({
    color: "fg.muted",
    _hover: { color: "fg.default" },
    "&[data-status=active]": { color: "fg.default", fontWeight: "medium" },
  }),
  user: css({ display: "flex", alignItems: "center", gap: "3", fontSize: "sm" }),
}

function ConsoleLayout() {
  const principal = usePrincipal()
  const queryClient = useQueryClient()
  // Every page of the console shows what its visitor's roles allow (administration, the apps they
  // manage, requests to answer): when their access changes, which is rare, all of it reloads.
  useLiveAccess(() => void queryClient.invalidateQueries())

  const leave = async () => {
    await signOut()
    queryClient.clear()
    location.assign(signInUrl("/"))
  }

  // The console's pages register commands (Ctrl+K), as they do in the shell.
  return (
    <CommandProvider>
      <div class={css({ minHeight: "100dvh", bg: "gray.2" })}>
        <header class={styles.header}>
          <span class={styles.brand}>
            <span class={styles.mark}>M</span> Console
          </span>
          <nav class={styles.nav} aria-label="Console">
            <For each={consoleNav(principal())}>
              {(item) => (
                <Link to={item.to} class={styles.link}>
                  {item.label}
                </Link>
              )}
            </For>
          </nav>
          <div class={styles.user}>
            <span>{principal().user?.name}</span>
            {/* Core's own page, outside the console. */}
            <a href={AGENT_CONNECTIONS_PATH} class={css({ color: "fg.muted", _hover: { color: "fg.default" } })}>
              AI clients
            </a>
            <ThemeToggle />
            <Button size="sm" variant="outline" onClick={() => void leave()}>
              Sign out
            </Button>
          </div>
        </header>
        <PageMain>
          <Show
            when={canUseConsole(principal())}
            fallback={
              <EmptyState
                icon={<Lock size={32} />}
                title="The console is for administrators and app owners"
                description="Ask an administrator if you need to manage users or an app."
              />
            }
          >
            <Outlet />
          </Show>
        </PageMain>
      </div>
    </CommandProvider>
  )
}
