import { createSignal, onCleanup } from "solid-js"
import { onPageThemeChange, type PageTheme, pageTheme } from "./shell"

/** The theme the page shows, following changes (to theme what is not styled by CSS, such as charts). */
export const usePageTheme = () => {
  const [theme, setTheme] = createSignal<PageTheme>(pageTheme())
  onCleanup(onPageThemeChange(setTheme))
  return theme
}
