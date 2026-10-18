import {
  type Accessor,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  type JSX,
  onCleanup,
  useContext,
} from "solid-js"

export type Theme = "light" | "dark" | "system"
export type ResolvedTheme = "light" | "dark"

export interface ThemeContextValue {
  theme: Accessor<Theme>
  resolved: Accessor<ResolvedTheme>
  setTheme: (theme: Theme) => void
}

export const THEME_STORAGE_KEY = "mosaik-theme"

const DARK_QUERY = "(prefers-color-scheme: dark)"

const ThemeContext = createContext<ThemeContextValue>()

const isTheme = (value: unknown): value is Theme => value === "light" || value === "dark" || value === "system"

function readStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    return isTheme(stored) ? stored : "system"
  } catch {
    return "system"
  }
}

function writeStoredTheme(theme: Theme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // Storage can be unavailable (private mode, quota); the in-memory theme still applies.
  }
}

function getDarkMediaQuery(): MediaQueryList | undefined {
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia(DARK_QUERY)
    : undefined
}

export function ThemeProvider(props: { children: JSX.Element }) {
  const [theme, setThemeSignal] = createSignal<Theme>(readStoredTheme())
  const media = getDarkMediaQuery()
  const [prefersDark, setPrefersDark] = createSignal(media?.matches ?? false)

  if (media) {
    const onChange = (event: MediaQueryListEvent) => setPrefersDark(event.matches)
    media.addEventListener("change", onChange)
    onCleanup(() => media.removeEventListener("change", onChange))
  }

  const resolved = createMemo<ResolvedTheme>(() => {
    const current = theme()
    if (current !== "system") return current
    return prefersDark() ? "dark" : "light"
  })

  createEffect(() => {
    document.documentElement.classList.toggle("dark", resolved() === "dark")
  })

  const setTheme = (next: Theme) => {
    setThemeSignal(next)
    writeStoredTheme(next)
  }

  return <ThemeContext.Provider value={{ theme, resolved, setTheme }}>{props.children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)
  if (!context) throw new Error("useTheme must be used within a <ThemeProvider>")
  return context
}
