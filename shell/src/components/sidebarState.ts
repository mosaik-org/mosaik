import { type Accessor, createSignal, onCleanup } from "solid-js"

const STORAGE_KEY = "mosaik.sidebar"

/** Room for the sidebar's labels beside a page (the theme's `lg` breakpoint). Narrower, it is a rail. */
const ROOMY_SCREEN = "(min-width: 64em)"

const readCollapsed = (): boolean => {
  try {
    return localStorage.getItem(STORAGE_KEY) === "collapsed"
  } catch {
    return false
  }
}

const storeCollapsed = (collapsed: boolean) => {
  try {
    localStorage.setItem(STORAGE_KEY, collapsed ? "collapsed" : "expanded")
  } catch {
    // Storage may be unavailable: the choice lasts until the page reloads.
  }
}

const createMediaQuery = (query: string): Accessor<boolean> => {
  const media = window.matchMedia(query)
  const [matches, setMatches] = createSignal(media.matches)
  const onChange = (event: MediaQueryListEvent) => setMatches(event.matches)
  media.addEventListener("change", onChange)
  onCleanup(() => media.removeEventListener("change", onChange))
  return matches
}

export interface SidebarState {
  /** A rail of icons beside the page, instead of the sidebar with its labels. */
  readonly rail: Accessor<boolean>
  /** The rail opened over the page, with its labels: on narrow screens, by its button. */
  readonly floating: Accessor<boolean>
  /** Whether the person's choice applies: a screen wide enough for the sidebar's labels. */
  readonly roomy: Accessor<boolean>
  /** The person's choice where there is room (remembered on this device); elsewhere, opens the rail over the page. */
  readonly toggle: () => void
  /** Closes the rail opened over the page (after going somewhere, or with Escape). */
  readonly close: () => void
  /** For the sidebar's element: the rail opened over the page closes when focus leaves it, or with Escape. */
  readonly handlers: {
    readonly onFocusOut: (event: FocusEvent) => void
    readonly onKeyDown: (event: KeyboardEvent) => void
  }
}

/**
 * The sidebar's state: with its labels, or a rail of icons that leaves the page more room. People
 * choose where there is room; narrower screens get the rail, which its button opens over the page.
 * Nothing else changes it, neither the page open nor the pointer resting on it: navigation would
 * move under the pointer that is about to use it.
 */
export const createSidebarState = (): SidebarState => {
  const [collapsed, setCollapsed] = createSignal(readCollapsed())
  const [floating, setFloating] = createSignal(false)
  const roomyScreen = createMediaQuery(ROOMY_SCREEN)
  // Never the page: navigation does not move under the person's pointer when they go somewhere.
  const roomy = roomyScreen
  const rail = () => !roomy() || collapsed()

  const close = () => setFloating(false)

  return {
    rail,
    floating: () => rail() && floating(),
    roomy,
    toggle: () => {
      if (!roomy()) return setFloating((open) => !open)
      close()
      setCollapsed((value) => !value)
      storeCollapsed(collapsed())
    },
    close,
    handlers: {
      onFocusOut: (event) => {
        const sidebar = event.currentTarget as HTMLElement
        if (!sidebar.contains(event.relatedTarget as Node | null)) close()
      },
      onKeyDown: (event) => {
        if (event.key === "Escape" && floating()) close()
      },
    },
  }
}
