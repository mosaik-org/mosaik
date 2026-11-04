import { Menu as ArkMenu } from "@ark-ui/solid/menu"
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
import { themeChoice } from "../../styled-system/recipes"
import { IconButton } from "../components/icon-button"
import { CheckIcon, MonitorIcon, MoonIcon, SunIcon } from "../components/icons"
import * as Menu from "../components/menu"

export type Theme = "light" | "dark" | "system"
export type ResolvedTheme = "light" | "dark"

export interface ThemeContextValue {
  /** What was chosen. */
  readonly theme: Accessor<Theme>
  /** What shows: `system` resolved by the operating system's preference. */
  readonly resolved: Accessor<ResolvedTheme>
  readonly setTheme: (theme: Theme) => void
}

/** Where the choice is kept in `localStorage`; a script in the page's `<head>` can read it before first paint. */
export const THEME_STORAGE_KEY = "mosaik-ui-theme"

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
 * Light, dark or the system's choice, kept across visits: sets the `dark` class on `<html>`,
 * which the library's dark styles follow.
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
  { value: "light", label: "Light", icon: SunIcon },
  { value: "dark", label: "Dark", icon: MoonIcon },
  { value: "system", label: "System", icon: MonitorIcon },
] as const

/** A button with a menu of Light, Dark and System, for a `ThemeProvider` above it. */
export const ThemeToggle = () => {
  const theme = useTheme()
  const icon = () => options.find((option) => option.value === theme.theme())?.icon ?? MonitorIcon
  return (
    <Menu.Root positioning={{ placement: "bottom-end" }}>
      <Menu.Trigger
        asChild={(trigger) => (
          <IconButton variant="plain" colorPalette="gray" aria-label="Change theme" {...trigger()}>
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
                    <Dynamic component={option.icon} />
                    <Menu.ItemText>{option.label}</Menu.ItemText>
                    <Menu.ItemIndicator>
                      <CheckIcon />
                    </Menu.ItemIndicator>
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

/**
 * Light, Dark and System as one row of a menu (`ActionMenu`'s children), the one in use pressed:
 * choosing one leaves the menu open, so the person sees what they chose. Ark's parts unstyled by
 * the menu's recipe: a row of small buttons, not the menu's full-width items.
 */
export const ThemeChoice = () => {
  const theme = useTheme()
  const classes = themeChoice()
  return (
    <ArkMenu.RadioItemGroup
      class={classes.root}
      value={theme.theme()}
      onValueChange={(details) => theme.setTheme(details.value as Theme)}
    >
      <ArkMenu.ItemGroupLabel class={classes.label}>Theme</ArkMenu.ItemGroupLabel>
      <div class={classes.options}>
        <For each={options}>
          {(option) => (
            <ArkMenu.RadioItem
              value={option.value}
              closeOnSelect={false}
              class={classes.option}
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
