import {
  type AssistantBrowser,
  AssistantBrowserProvider,
  AssistantPanel,
  assistant,
  openPanel,
  panelOpen,
  setPanelOpen,
} from "@mosaik/assistant/web"
import { usePrincipal } from "@mosaik/auth/web"
import { IconButton, Kbd, Tooltip } from "@mosaik/mosaik-ui"
import { css, cx } from "@mosaik/styled-system/css"
import {
  createFrameHeaderStack,
  FrameHeaderProvider,
  PageMain,
  useCommandPalette,
  useCommands,
  useFindPlaces,
  usePageLayout,
} from "@mosaik/web-kit"
import { useQuery } from "@tanstack/solid-query"
import { Link, useNavigate, useRouterState } from "@tanstack/solid-router"
import Menu from "lucide-solid/icons/menu"
import PanelLeftClose from "lucide-solid/icons/panel-left-close"
import PanelLeftOpen from "lucide-solid/icons/panel-left-open"
import Search from "lucide-solid/icons/search"
import Sparkles from "lucide-solid/icons/sparkles"
import { type Accessor, createEffect, createSignal, type JSX, on, onCleanup, onMount, Show, Suspense } from "solid-js"
import { allApps, appForPath } from "../apps"
import { NotificationBell } from "../notifications/NotificationBell"
import { StatusesProvider } from "../statuses/StatusesProvider"
import { Sidebar, type SidebarMode } from "./Sidebar"
import { createSidebarState, type SidebarState } from "./sidebarState"
import { UserMenu } from "./UserMenu"

const styles = {
  // The sidebar's column is as wide as the sidebar: with its labels, or a rail.
  shell: css({
    display: "grid",
    gridTemplateColumns: { base: "1fr", md: "auto 1fr" },
    minHeight: "100dvh",
  }),
  // A page with the `full` layout gets exactly the window's height, which it fills and scrolls inside.
  shellFull: css({ height: "100dvh", gridTemplateRows: "minmax(0, 1fr)", overflow: "hidden" }),
  // The page beside the assistant: on wide screens it makes room as the assistant slides in, and on
  // narrower ones the assistant is over it.
  page: css({
    display: "flex",
    flexDirection: "column",
    flex: "1",
    minWidth: "0",
    minHeight: "0",
    transition: "margin-right token(durations.normal) token(easings.standard)",
    _motionReduce: { transition: "none" },
    "&[data-assistant=true]": { marginRight: { lg: "400px" } },
  }),
  // Under the header, which stays whole above it, and in from the right edge. Fixed, so that a page
  // scrolling the document leaves it where it is.
  assistant: css({
    position: "fixed",
    top: "14",
    right: "0",
    bottom: "0",
    zIndex: { base: "overlay", lg: "auto" },
    width: { base: "full", sm: "400px" },
    borderLeftWidth: "1px",
    boxShadow: { base: "lg", lg: "none" },
    translate: "100% 0",
    transition: "translate token(durations.normal) token(easings.standard)",
    _motionReduce: { transition: "none" },
    "&[data-open=true]": { translate: "0 0" },
  }),
  aside: css({
    hideBelow: "md",
    position: "sticky",
    top: "0",
    height: "100dvh",
    width: "240px",
    transition: "width 0.2s ease",
    _motionReduce: { transition: "none" },
    "&[data-rail=true]": { width: "64px" },
    // Sticky, it stacks its content on its own: open over the page, it is raised above the top bar.
    "&[data-floating=true]": { zIndex: "banner" },
  }),
  sidebar: css({
    display: "flex",
    flexDirection: "column",
    width: "full",
    height: "full",
    overflow: "hidden",
    borderRightWidth: "1px",
    bg: "gray.2",
    // The rail opened over the page, as wide as the sidebar.
    "&[data-floating=true]": { position: "absolute", insetY: "0", left: "0", width: "240px", boxShadow: "lg" },
  }),
  sidebarFooter: css({ display: "flex", px: "3", py: "3", borderTopWidth: "1px" }),
  // Padded like the links above it: its icon in their column.
  sidebarToggle: css({
    display: "flex",
    alignItems: "center",
    px: "3",
    py: "2",
    borderRadius: "md",
    color: "fg.muted",
    cursor: "pointer",
    transition: "background 0.15s, color 0.15s",
    _hover: { bg: "gray.subtle.bg", color: "fg.default" },
    _focusVisible: { outline: "2px solid", outlineColor: "accent.solid.bg", outlineOffset: "-2px" },
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
    flexShrink: "0",
    height: "14",
    // The logo centred on the links' icons (18 px, after the sidebar's and the link's padding), so
    // it stays in place when the sidebar collapses to a rail.
    pl: "calc(token(spacing.3) + token(spacing.3) + 9px - token(sizes.7) / 2)",
    pr: "6",
    fontWeight: "bold",
    fontSize: "lg",
    letterSpacing: "tight",
    whiteSpace: "nowrap",
    // In the rail its right padding has no room: it is cut, not the logo.
    overflow: "hidden",
  }),
  logo: css({
    // Square at any width: the row never shrinks it.
    flexShrink: "0",
    display: "grid",
    placeItems: "center",
    width: "7",
    height: "7",
    borderRadius: "md",
    bg: "accent.solid.bg",
    color: "accent.solid.fg",
    fontSize: "sm",
  }),
  content: css({
    display: "flex",
    flexDirection: "column",
    minWidth: "0",
    minHeight: "0",
    // A `full` page starts under the header, which overlays it: what the page scrolls passes under
    // the frosted header, as on other pages. The page knows where its content starts (`FRAME_TOP`).
    "&[data-layout=full]": {
      position: "relative",
      "--mk-frame-top": "sizes.14",
      "& > header": { position: "absolute", insetX: "0" },
    },
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
  // What the page puts in the header: the room left beside the frame's own buttons, cut short if it must.
  // As tall as the header, so a page's tabs can mark the open one along its bottom edge.
  pageHeader: css({
    display: "flex",
    alignItems: "center",
    alignSelf: "stretch",
    gap: "3",
    flex: "1",
    minW: "0",
    overflow: "hidden",
  }),
  search: css({
    display: "flex",
    alignItems: "center",
    gap: "2",
    flexShrink: "0",
    h: "9",
    pl: "3",
    pr: "2",
    // A box with its shortcut where the bar has room; an icon where pages need it for their tabs.
    minW: { base: "auto", xl: "56" },
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
      <span class={css({ flex: "1", textAlign: "start", hideBelow: "xl" })}>Search…</span>
      <span class={css({ display: "flex", gap: "1", hideBelow: "xl" })}>
        <Kbd>{isMac ? "⌘" : "Ctrl"}</Kbd>
        <Kbd>K</Kbd>
      </span>
    </button>
  )
}

const Brand = (props: { rail?: boolean }) => (
  <Link to="/" class={styles.brand}>
    <span class={styles.logo} aria-hidden="true">
      M
    </span>
    <span class={props.rail === true ? css({ srOnly: true }) : undefined}>Mosaik</span>
  </Link>
)

/** Collapses or expands the sidebar where people choose; elsewhere, opens the rail over the page. */
const SidebarToggle = (props: { state: SidebarState }) => {
  // What a click does: where people choose, expand or collapse it; elsewhere, open or close the rail.
  const opens = () => (props.state.roomy() ? props.state.rail() : !props.state.floating())
  const label = () =>
    props.state.roomy()
      ? `${opens() ? "Expand" : "Collapse"} the sidebar (Ctrl+B)`
      : `${opens() ? "Open" : "Close"} the sidebar`
  return (
    <div class={styles.sidebarFooter}>
      <Tooltip content={label()} positioning={{ placement: "right" }}>
        {(trigger) => (
          <button
            type="button"
            {...trigger()}
            class={styles.sidebarToggle}
            aria-label={label()}
            onClick={() => props.state.toggle()}
          >
            <Show when={opens()} fallback={<PanelLeftClose size={18} />}>
              <PanelLeftOpen size={18} />
            </Show>
          </button>
        )}
      </Tooltip>
    </div>
  )
}

/** Ctrl/⌘+B, except where it formats text. */
const isSidebarShortcut = (event: KeyboardEvent) =>
  (event.ctrlKey || event.metaKey) &&
  !event.altKey &&
  event.key.toLowerCase() === "b" &&
  !(event.target instanceof HTMLElement && event.target.isContentEditable)

/**
 * The assistant's browser tools, run by the shell: it finds places as the command palette does
 * (pages, and records through apps' search providers), and opens them with the conversation in
 * the side panel, also from the assistant's own page.
 */
const useAssistantBrowser = (): AssistantBrowser => {
  const findPlaces = useFindPlaces()
  const navigate = useNavigate()
  return {
    findPlaces: async (query) =>
      (await findPlaces(query)).map((place) => ({
        title: place.title,
        ...(place.subtitle === undefined ? {} : { subtitle: place.subtitle }),
        group: place.group,
        path: place.to,
      })),
    openPage: (path, conversation) => {
      openPanel(conversation)
      void navigate({ href: path })
    },
    appName: (id) => allApps.find((app) => app.id === id)?.name,
  }
}

/** How long the assistant takes to slide away: `normal`, the transition's duration. */
const ASSISTANT_EXIT_MS = 200

/**
 * Keeps something on the page for as long as it slides: `mounted` from before it comes in until after it
 * has gone, `shown` for which way it is going. Coming in, it first renders as gone, for there to be
 * something to move from. Toggled midway, its transition just turns around.
 */
const createPresence = (open: Accessor<boolean>) => {
  const [mounted, setMounted] = createSignal(open())
  const [shown, setShown] = createSignal(open())
  createEffect(
    on(
      open,
      (isOpen) => {
        if (isOpen) {
          setMounted(true)
          let frame = requestAnimationFrame(() => {
            frame = requestAnimationFrame(() => setShown(true))
          })
          onCleanup(() => cancelAnimationFrame(frame))
        } else {
          setShown(false)
          const timer = setTimeout(() => setMounted(false), ASSISTANT_EXIT_MS)
          onCleanup(() => clearTimeout(timer))
        }
      },
      { defer: true },
    ),
  )
  return { mounted, shown }
}

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
  const principal = usePrincipal()
  const status = useQuery(() => ({ ...assistant.assistant.status.query(), enabled: principal().isAuthenticated }))
  const router = useRouterState()
  const navigate = useNavigate()
  const assistantReady = () => principal().isAuthenticated && status.data?.enabled === true
  const assistantOpen = () => panelOpen() && assistantReady()
  const assistantPanel = createPresence(assistantOpen)
  const context = usePageContext()
  const assistantBrowser = useAssistantBrowser()
  const layout = usePageLayout()
  const frameHeader = createFrameHeaderStack()
  const sidebar = createSidebarState()
  const sidebarMode = (): SidebarMode => (sidebar.rail() ? (sidebar.floating() ? "floating" : "rail") : "full")

  useCommands(() =>
    sidebar.roomy()
      ? [
          {
            id: "shell:sidebar",
            title: sidebar.rail() ? "Expand the sidebar" : "Collapse the sidebar",
            group: "Actions",
            icon: sidebar.rail() ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />,
            keywords: ["navigation", "menu", "rail"],
            perform: sidebar.toggle,
          },
        ]
      : [],
  )

  onMount(() => {
    // Ctrl/⌘+J opens and closes the assistant; Ctrl/⌘+B collapses and expands the sidebar.
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "j" && assistantReady()) {
        event.preventDefault()
        setPanelOpen((open) => !open)
      }
      if (isSidebarShortcut(event)) {
        event.preventDefault()
        sidebar.toggle()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    onCleanup(() => window.removeEventListener("keydown", onKeyDown))
  })

  return (
    <StatusesProvider>
      <AssistantBrowserProvider value={assistantBrowser}>
        <div class={cx(styles.shell, layout() === "full" && styles.shellFull)}>
          <aside
            class={styles.aside}
            data-rail={sidebar.rail()}
            data-floating={sidebar.floating()}
            {...sidebar.handlers}
          >
            <div class={styles.sidebar} data-floating={sidebar.floating()}>
              <Brand rail={sidebarMode() === "rail"} />
              <Sidebar mode={sidebarMode()} onNavigate={sidebar.close} />
              <SidebarToggle state={sidebar} />
            </div>
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

          <div class={styles.content} data-layout={layout()}>
            <header class={styles.header}>
              <div class={css({ hideFrom: "md" })}>
                <IconButton variant="plain" aria-label="Open navigation" onClick={() => setDrawerOpen(true)}>
                  <Menu size={18} />
                </IconButton>
              </div>
              {/* The page's: its title, navigation, actions (`FrameHeader`). */}
              <div class={styles.pageHeader}>{frameHeader.current()}</div>
              <SearchButton />
              <Show when={assistantReady()}>
                <IconButton
                  variant={assistantOpen() ? "subtle" : "plain"}
                  aria-label="Assistant (Ctrl+J)"
                  aria-pressed={assistantOpen()}
                  onClick={() => setPanelOpen((open) => !open)}
                >
                  <Sparkles size={18} />
                </IconButton>
              </Show>
              <Show when={principal().isAuthenticated}>
                <NotificationBell />
              </Show>
              <UserMenu />
            </header>
            <div class={styles.page} data-assistant={assistantPanel.shown()}>
              <PageMain>
                <FrameHeaderProvider stack={frameHeader}>{props.children}</FrameHeaderProvider>
              </PageMain>
            </div>
          </div>

          <Show when={assistantPanel.mounted()}>
            <aside class={styles.assistant} data-open={assistantPanel.shown()}>
              {/*
                  Its own boundary: what it loads the first time would otherwise suspend the page around
                  it, blanking the page and leaving nothing to slide in until it has loaded.
                */}
              <Suspense>
                <AssistantPanel
                  context={context}
                  onClose={() => setPanelOpen(false)}
                  onExpand={(conversation) => {
                    const from = router().location.href
                    setPanelOpen(false)
                    void navigate(
                      conversation === null
                        ? { to: "/assistant", search: { from } }
                        : { to: "/assistant/$conversation", params: { conversation }, search: { from } },
                    )
                  }}
                />
              </Suspense>
            </aside>
          </Show>
        </div>
      </AssistantBrowserProvider>
    </StatusesProvider>
  )
}
