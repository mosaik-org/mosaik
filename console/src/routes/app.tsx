import { AGENT_CONNECTIONS_PATH, signInUrl } from "@mosaik/auth/contract"
import { sessionQueryOptions, signOut, useLiveAccess, usePrincipal } from "@mosaik/auth/web"
import { canUseConsole, consoleNav } from "@mosaik/console"
import { CommandProvider, createFrameHeaderStack, FrameHeaderProvider, PageMain } from "@mosaik/frame"
import { css } from "@mosaik/styled-system/css"
import { Button, EmptyState } from "@mosaik/ui"
import { ThemeToggle } from "@mosaik/web-kit"
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
    bg: "bg.subtle",
  }),
  brand: css({ display: "flex", alignItems: "center", gap: "2", fontWeight: "semibold" }),
  mark: css({
    display: "grid",
    placeItems: "center",
    width: "7",
    height: "7",
    borderRadius: "md",
    bg: "accent.solid",
    color: "accent.contrast",
    fontSize: "sm",
  }),
  nav: css({ display: "flex", gap: "4", flex: "1", fontSize: "sm" }),
  link: css({
    color: "fg.muted",
    _hover: { color: "fg" },
    "&[data-status=active]": { color: "fg", fontWeight: "medium" },
  }),
  user: css({ display: "flex", alignItems: "center", gap: "3", fontSize: "sm" }),
  // The page's: its title, navigation, actions (`FrameHeader`), as in the shell's top bar.
  pageBar: css({
    display: "flex",
    alignItems: "center",
    gap: "3",
    h: "12",
    minW: "0",
    px: { base: "4", md: "6" },
    borderBottomWidth: "1px",
    borderColor: "border",
    bg: "bg.subtle",
    overflow: "hidden",
  }),
}

function ConsoleLayout() {
  const principal = usePrincipal()
  const queryClient = useQueryClient()
  const frameHeader = createFrameHeaderStack()
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
      <div class={css({ minHeight: "100dvh", bg: "bg" })}>
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
            <a href={AGENT_CONNECTIONS_PATH} class={css({ color: "fg.muted", _hover: { color: "fg" } })}>
              AI clients
            </a>
            <ThemeToggle />
            <Button size="sm" variant="outline" onClick={() => void leave()}>
              Sign out
            </Button>
          </div>
        </header>
        <Show when={frameHeader.current()}>
          <div class={styles.pageBar}>{frameHeader.current()}</div>
        </Show>
        <PageMain>
          <Show
            when={canUseConsole(principal())}
            fallback={
              <EmptyState.Root>
                <EmptyState.Indicator>
                  <Lock />
                </EmptyState.Indicator>
                <EmptyState.Content>
                  <EmptyState.Title>The console is for administrators and app owners</EmptyState.Title>
                  <EmptyState.Description>
                    Ask an administrator if you need to manage users or an app.
                  </EmptyState.Description>
                </EmptyState.Content>
              </EmptyState.Root>
            }
          >
            <FrameHeaderProvider stack={frameHeader}>
              <Outlet />
            </FrameHeaderProvider>
          </Show>
        </PageMain>
      </div>
    </CommandProvider>
  )
}
