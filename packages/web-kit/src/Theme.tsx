import { Menu as ArkMenu } from "@ark-ui/solid/menu"
import { css } from "@mosaik/styled-system/css"
import { IconButton, Menu } from "@mosaik/ui"
import Monitor from "lucide-solid/icons/monitor"
import Moon from "lucide-solid/icons/moon"
import Sun from "lucide-solid/icons/sun"
import {
  type Accessor,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  For,
  type JSX,
  onCleanup,
  useContext,
} from "solid-js"
import { Dynamic, Portal } from "solid-js/web"

export type Theme = "light" | "dark" | "system"
export type ResolvedTheme = "light" | "dark"

export interface ThemeContextValue {
  /** What was chosen. */
  readonly theme: Accessor<Theme>
  /** What shows: `system` resolved by the operating system's preference. */
  readonly resolved: Accessor<ResolvedTheme>
  readonly setTheme: (theme: Theme) => void
}

/**
 * Where the choice is kept in `localStorage`. The pages' `<head>` reads it before first paint (the
 * shell's, the console's, a standalone app's), so the page never flashes the other theme: they name
 * this key too.
 */
export const THEME_STORAGE_KEY = "mosaik-theme"

const ThemeContext = createContext<ThemeContextValue>()

const isTheme = (value: unknown): value is Theme => value === "light" || value === "dark" || value === "system"

const stored = (key: string): Theme => {
  try {
    const value = localStorage.getItem(key)
    return isTheme(value) ? value : "system"
  } catch {
    return "system"
  }
}

/**
 * Light, dark or the system's choice, kept across visits: sets the `dark` class on `<html>`, which
 * `@mosaik/ui`'s dark styles follow. Mosaik's, not the library's: where the choice is kept and who
 * offers it (the user menu, the command palette) is the product's.
 */
export const ThemeProvider = (props: { readonly storageKey?: string; readonly children: JSX.Element }) => {
  const key = props.storageKey ?? THEME_STORAGE_KEY
  const [theme, setThemeSignal] = createSignal<Theme>(stored(key))
  const media = typeof window !== "undefined" ? window.matchMedia?.("(prefers-color-scheme: dark)") : undefined
  const [prefersDark, setPrefersDark] = createSignal(media?.matches ?? false)
  if (media) {
    const onChange = (event: MediaQueryListEvent) => setPrefersDark(event.matches)
    media.addEventListener("change", onChange)
    onCleanup(() => media.removeEventListener("change", onChange))
  }
  const resolved = createMemo<ResolvedTheme>(() => {
    const current = theme()
    return current === "system" ? (prefersDark() ? "dark" : "light") : current
  })
  createEffect(() => document.documentElement.classList.toggle("dark", resolved() === "dark"))
  const setTheme = (next: Theme) => {
    setThemeSignal(next)
    try {
      localStorage.setItem(key, next)
    } catch {
      // Storage can be unavailable (private mode, quota); the choice still applies until reload.
    }
  }
  return <ThemeContext.Provider value={{ theme, resolved, setTheme }}>{props.children}</ThemeContext.Provider>
}

export const useTheme = (): ThemeContextValue => {
  const context = useContext(ThemeContext)
  if (!context) throw new Error("useTheme must be used within a <ThemeProvider>")
  return context
}

const options = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const

/** A button with a menu of Light, Dark and System, for a `ThemeProvider` above it. */
export const ThemeToggle = () => {
  const theme = useTheme()
  const icon = () => options.find((option) => option.value === theme.theme())?.icon ?? Monitor
  return (
    <Menu.Root positioning={{ placement: "bottom-end" }}>
      <Menu.Trigger
        asChild={(trigger) => (
          <IconButton variant="ghost" aria-label="Change theme" {...trigger()}>
            <Dynamic component={icon()} />
          </IconButton>
        )}
      />
      <Portal>
        <Menu.Positioner>
          <Menu.Content>
            <Menu.RadioItemGroup
              value={theme.theme()}
              onValueChange={(details) => theme.setTheme(details.value as Theme)}
            >
              <For each={options}>
                {(option) => (
                  <Menu.RadioItem value={option.value}>
                    <Menu.ItemIndicator />
                    <Menu.ItemText>{option.label}</Menu.ItemText>
                  </Menu.RadioItem>
                )}
              </For>
            </Menu.RadioItemGroup>
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  )
}

const choice = {
  root: css({ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "4", px: "2", py: "1" }),
  label: css({ textStyle: "sm", color: "fg.muted" }),
  options: css({ display: "flex", gap: "0.5", p: "0.5", borderRadius: "l2", bg: "gray.subtle" }),
  option: css({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "8",
    height: "7",
    borderRadius: "l1",
    color: "fg.muted",
    cursor: "pointer",
    outline: "0",
    "& svg": { boxSize: "4" },
    _highlighted: { bg: "gray.subtle.hover", color: "fg" },
    _checked: { bg: "bg.panel", color: "fg", boxShadow: "xs" },
  }),
}

/**
 * Light, Dark and System as one row of a menu (inside `Menu.Content`), the one in use pressed:
 * choosing one leaves the menu open, so the person sees what they chose. Ark's parts, unstyled by
 * the menu's recipe: a row of small buttons, not the menu's full-width items.
 */
export const ThemeChoice = () => {
  const theme = useTheme()
  return (
    <ArkMenu.RadioItemGroup
      class={choice.root}
      value={theme.theme()}
      onValueChange={(details) => theme.setTheme(details.value as Theme)}
    >
      <ArkMenu.ItemGroupLabel class={choice.label}>Theme</ArkMenu.ItemGroupLabel>
      <div class={choice.options}>
        <For each={options}>
          {(option) => (
            <ArkMenu.RadioItem
              value={option.value}
              closeOnSelect={false}
              class={choice.option}
              aria-label={option.label}
              title={option.label}
            >
              <Dynamic component={option.icon} />
            </ArkMenu.RadioItem>
          )}
        </For>
      </div>
    </ArkMenu.RadioItemGroup>
  )
}
