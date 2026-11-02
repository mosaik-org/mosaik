import { AssistantPanel, assistant } from "@mosaik/assistant/web"
import { usePrincipal } from "@mosaik/auth/web"
import { IconButton, Kbd, ThemeToggle } from "@mosaik/mosaik-ui"
import { css } from "@mosaik/styled-system/css"
import { PageMain, useCommandPalette } from "@mosaik/web-kit"
import { useQuery } from "@tanstack/solid-query"
import { Link, useRouterState } from "@tanstack/solid-router"
import Menu from "lucide-solid/icons/menu"
import Search from "lucide-solid/icons/search"
import Sparkles from "lucide-solid/icons/sparkles"
import { createSignal, type JSX, onCleanup, onMount, Show } from "solid-js"
import { appForPath } from "../apps"
import { NotificationBell } from "../notifications/NotificationBell"
import { Sidebar } from "./Sidebar"
import { UserMenu } from "./UserMenu"

const styles = {
  shell: css({
    display: "grid",
    gridTemplateColumns: { base: "1fr", md: "240px 1fr" },
    minHeight: "100dvh",
  }),
  // With the assistant open, a third column on wide screens.
  shellWithAssistant: css({ gridTemplateColumns: { base: "1fr", md: "240px 1fr", lg: "240px 1fr 400px" } }),
  assistant: css({
    // Docked on wide screens; over the page on narrower ones.
    position: { base: "fixed", lg: "sticky" },
    inset: { base: "0", lg: "auto" },
    top: { lg: "0" },
    zIndex: { base: "overlay", lg: "auto" },
    width: { base: "full", sm: "400px" },
    left: { sm: "auto" },
    height: "100dvh",
    borderLeftWidth: "1px",
    boxShadow: { base: "lg", lg: "none" },
  }),
  aside: css({
    hideBelow: "md",
    position: "sticky",
    top: "0",
    height: "100dvh",
    display: "flex",
    flexDirection: "column",
    borderRightWidth: "1px",
    bg: "gray.2",
  }),
  drawer: css({
    position: "fixed",
    inset: "0",
    zIndex: "overlay",
    display: "flex",
    hideFrom: "md",
  }),
  drawerPanel: css({
    width: "260px",
    display: "flex",
    flexDirection: "column",
    bg: "gray.surface.bg",
    borderRightWidth: "1px",
    animation: "slide-from-bottom 0.15s ease-out",
  }),
  backdrop: css({ flex: "1", bg: "black.a7" }),
  brand: css({
    display: "flex",
    alignItems: "center",
    gap: "2",
    height: "14",
    px: "6",
    fontWeight: "bold",
    fontSize: "lg",
    letterSpacing: "tight",
  }),
  logo: css({
    display: "grid",
    placeItems: "center",
    width: "7",
    height: "7",
    borderRadius: "md",
    bg: "accent.solid.bg",
    color: "accent.solid.fg",
    fontSize: "sm",
  }),
  header: css({
    position: "sticky",
    top: "0",
    zIndex: "sticky",
    display: "flex",
    alignItems: "center",
    gap: "2",
    height: "14",
    px: { base: "4", md: "8" },
    borderBottomWidth: "1px",
    bg: "canvas/85",
    backdropFilter: "blur(8px)",
  }),
  search: css({
    display: "flex",
    alignItems: "center",
    gap: "2",
    h: "9",
    pl: "3",
    pr: "2",
    minW: { base: "auto", md: "64" },
    borderWidth: "1px",
    borderRadius: "l2",
    bg: "gray.2",
    color: "fg.subtle",
    fontSize: "sm",
    cursor: "pointer",
    transition: "border-color 0.15s",
    _hover: { borderColor: "gray.outline.border" },
    _focusVisible: { outline: "2px solid", outlineColor: "accent.solid.bg" },
  }),
}

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform)

const SearchButton = () => {
  const palette = useCommandPalette()
  return (
    <button type="button" class={styles.search} onClick={palette.open} aria-label="Search (Ctrl+K)">
      <Search size={16} />
      <span class={css({ flex: "1", textAlign: "start", hideBelow: "md" })}>Search…</span>
      <span class={css({ display: "flex", gap: "1", hideBelow: "md" })}>
        <Kbd>{isMac ? "⌘" : "Ctrl"}</Kbd>
        <Kbd>K</Kbd>
      </span>
    </button>
  )
}

const Brand = () => (
  <Link to="/" class={styles.brand}>
    <span class={styles.logo}>M</span>
    Mosaik
  </Link>
)

/** Where the person is, for the assistant: the app, the path and the page's title. */
const usePageContext = () => {
  const router = useRouterState()
  return () => {
    const { location, matches } = router()
    return {
      app: appForPath(location.pathname)?.id ?? null,
      path: location.href,
      title: matches.findLast((match) => match.staticData?.title !== undefined)?.staticData.title ?? null,
    }
  }
}

export const AppShell = (props: { children: JSX.Element }) => {
  const [drawerOpen, setDrawerOpen] = createSignal(false)
  const [assistantOpen, setAssistantOpen] = createSignal(false)
  const principal = usePrincipal()
  const status = useQuery(() => ({ ...assistant.assistant.status.query(), enabled: principal().isAuthenticated }))
  const assistantReady = () => principal().isAuthenticated && status.data?.enabled === true
  const context = usePageContext()

  onMount(() => {
    // Ctrl/⌘+J opens and closes the assistant.
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "j" && assistantReady()) {
        event.preventDefault()
        setAssistantOpen((open) => !open)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    onCleanup(() => window.removeEventListener("keydown", onKeyDown))
  })

  return (
    <div class={`${styles.shell} ${assistantOpen() ? styles.shellWithAssistant : ""}`}>
      <aside class={styles.aside}>
        <Brand />
        <Sidebar />
      </aside>

      <Show when={drawerOpen()}>
        <div class={styles.drawer}>
          <div class={styles.drawerPanel}>
            <Brand />
            <Sidebar onNavigate={() => setDrawerOpen(false)} />
          </div>
          <div class={styles.backdrop} onClick={() => setDrawerOpen(false)} aria-hidden="true" />
        </div>
      </Show>

      <div class={css({ display: "flex", flexDirection: "column", minWidth: "0" })}>
        <header class={styles.header}>
          <div class={css({ hideFrom: "md" })}>
            <IconButton variant="plain" aria-label="Open navigation" onClick={() => setDrawerOpen(true)}>
              <Menu size={18} />
            </IconButton>
          </div>
          <SearchButton />
          <div class={css({ flex: "1" })} />
          <Show when={assistantReady()}>
            <IconButton
              variant={assistantOpen() ? "subtle" : "plain"}
              aria-label="Assistant (Ctrl+J)"
              aria-pressed={assistantOpen()}
              onClick={() => setAssistantOpen((open) => !open)}
            >
              <Sparkles size={18} />
            </IconButton>
          </Show>
          <ThemeToggle />
          <Show when={principal().isAuthenticated}>
            <NotificationBell />
          </Show>
          <UserMenu />
        </header>
        <PageMain>{props.children}</PageMain>
      </div>

      <Show when={assistantOpen() && assistantReady()}>
        <aside class={styles.assistant}>
          <AssistantPanel context={context} onClose={() => setAssistantOpen(false)} />
        </aside>
      </Show>
    </div>
  )
}
