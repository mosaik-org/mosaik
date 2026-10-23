import { usePrincipal } from "@mosaik/auth/web"
import { IconButton, Kbd, ThemeToggle } from "@mosaik/mosaik-ui"
import { css } from "@mosaik/styled-system/css"
import { PageMain, useCommandPalette } from "@mosaik/web-kit"
import { Link } from "@tanstack/solid-router"
import Menu from "lucide-solid/icons/menu"
import Search from "lucide-solid/icons/search"
import { createSignal, type JSX, Show } from "solid-js"
import { NotificationBell } from "../notifications/NotificationBell"
import { Sidebar } from "./Sidebar"
import { UserMenu } from "./UserMenu"

const styles = {
  shell: css({
    display: "grid",
    gridTemplateColumns: { base: "1fr", md: "240px 1fr" },
    minHeight: "100dvh",
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

export const AppShell = (props: { children: JSX.Element }) => {
  const [drawerOpen, setDrawerOpen] = createSignal(false)
  const principal = usePrincipal()

  return (
    <div class={styles.shell}>
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
          <ThemeToggle />
          <Show when={principal().isAuthenticated}>
            <NotificationBell />
          </Show>
          <UserMenu />
        </header>
        <PageMain>{props.children}</PageMain>
      </div>
    </div>
  )
}
