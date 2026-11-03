import { type Accessor, createSignal, onCleanup } from "solid-js"

const STORAGE_KEY = "mosaik.sidebar"

/** Room for the sidebar's labels beside a page (the theme's `lg` breakpoint). Narrower, it is a rail. */
const ROOMY_SCREEN = "(min-width: 64em)"

/** How long the pointer rests on the rail before it opens over the page, and leaves before it closes. */
const OPEN_DELAY = 200
const CLOSE_DELAY = 250

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
  /** The rail opened over the page, with its labels: while the pointer rests on it or focus is in it. */
  readonly floating: Accessor<boolean>
  /** Whether the person's choice applies: a screen wide enough for the sidebar's labels. */
  readonly roomy: Accessor<boolean>
  /** The person's choice where there is room (remembered on this device); elsewhere, opens the rail over the page. */
  readonly toggle: () => void
  /** Closes the rail opened over the page (after going somewhere, or with Escape). */
  readonly close: () => void
  /** For the sidebar's element: opening over the page on hover and focus. */
  readonly handlers: {
    readonly onPointerEnter: (event: PointerEvent) => void
    readonly onPointerLeave: (event: PointerEvent) => void
    readonly onFocusIn: () => void
    readonly onFocusOut: (event: FocusEvent) => void
    readonly onKeyDown: (event: KeyboardEvent) => void
  }
}

/**
 * The sidebar's state: with its labels, or a rail of icons that leaves the page more room. People
 * choose where there is room; narrower screens get the rail, which opens over the page when the
 * pointer rests on it or focus enters it, so every link stays at hand. Which page is open never
 * changes it: navigation would move under the pointer that just used it.
 */
export const createSidebarState = (): SidebarState => {
  const [collapsed, setCollapsed] = createSignal(readCollapsed())
  const [floating, setFloating] = createSignal(false)
  const roomyScreen = createMediaQuery(ROOMY_SCREEN)
  // Never the page: navigation does not move under the person's pointer when they go somewhere.
  const roomy = roomyScreen
  const rail = () => !roomy() || collapsed()

  let timer: ReturnType<typeof setTimeout> | undefined
  const later = (delay: number, open: boolean) => {
    clearTimeout(timer)
    timer = setTimeout(() => setFloating(open), delay)
  }
  onCleanup(() => clearTimeout(timer))

  const close = () => {
    clearTimeout(timer)
    setFloating(false)
  }

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
      // Touch has no hover: a tap opens the link under it, and the toggle opens the rail.
      onPointerEnter: (event) => {
        if (rail() && event.pointerType === "mouse") later(OPEN_DELAY, true)
      },
      onPointerLeave: (event) => {
        if (event.pointerType === "mouse") later(CLOSE_DELAY, false)
      },
      onFocusIn: () => {
        if (rail()) setFloating(true)
      },
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
