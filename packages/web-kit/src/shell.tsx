import { onPageThemeChange, type PageTheme, pageTheme, provideToaster } from "@mosaik/client"
import { Toaster, toaster } from "@mosaik/mosaik-ui"
import { createSignal, onCleanup } from "solid-js"

/**
 * Renders the toasts of `toast` (`@mosaik/client`) and provides it to the page. The shell renders
 * it for the apps mounted in it; a standalone page renders it once, near its root.
 */
export const Toasts = () => {
  onCleanup(provideToaster({ show: (next) => toaster.create(next) }))
  return <Toaster />
}

/** The theme the page shows, following changes (to theme what is not styled by CSS, such as charts). */
export const usePageTheme = () => {
  const [theme, setTheme] = createSignal<PageTheme>(pageTheme())
  onCleanup(onPageThemeChange(setTheme))
  return theme
}
