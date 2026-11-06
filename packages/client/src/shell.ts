/**
 * What a page asks of the shell around it, whatever it is built with: toasts and the theme. The
 * shell provides them to the apps mounted in it; a standalone page provides its own (the SDK's
 * `<Toasts />`, a theme provider), and its code calls the same functions.
 */

export type ToastType = "success" | "error" | "warning" | "info"

export interface Toast {
  readonly type: ToastType
  readonly title: string
  readonly description?: string
  /** A button in the toast, such as Undo. */
  readonly action?: ToastAction
}

export interface ToastAction {
  readonly label: string
  readonly onClick: () => void
}

/** Shows toasts: the shell's, or a standalone page's. */
export interface Toaster {
  readonly show: (toast: Toast) => void
}

let toaster: Toaster | undefined
/** Toasts shown before a toaster exists (during startup): shown when one is provided. */
const waiting: Array<Toast> = []

/** Called by whatever renders the toasts (the shell, or a standalone page's `<Toasts />`). */
export const provideToaster = (provided: Toaster): (() => void) => {
  toaster = provided
  for (const queued of waiting.splice(0)) provided.show(queued)
  return () => {
    if (toaster === provided) toaster = undefined
  }
}

const show = (type: ToastType) => (title: string, description?: string, action?: ToastAction) => {
  const next: Toast = {
    type,
    title,
    ...(description === undefined ? {} : { description }),
    ...(action === undefined ? {} : { action }),
  }
  if (toaster) toaster.show(next)
  else waiting.push(next)
}

/**
 * A short message in the corner: `toast.success("Saved")`, `toast.error("Could not save", reason)`,
 * `toast.success("Assigned", undefined, { label: "Undo", onClick: undo })`.
 * In the shell it shows with the shell's own toasts; on a standalone page, in its `<Toasts />`.
 */
export const toast = {
  success: show("success"),
  error: show("error"),
  warning: show("warning"),
  info: show("info"),
}

export type PageTheme = "light" | "dark"

/**
 * The theme the page shows. The shell (or a standalone page's theme provider) sets the `dark` class
 * on `<html>`; pages read it rather than choosing one, so every app on a page agrees.
 */
export const pageTheme = (): PageTheme =>
  typeof document !== "undefined" && document.documentElement.classList.contains("dark") ? "dark" : "light"

/** Calls `listener` when the page's theme changes; returns what stops it. */
export const onPageThemeChange = (listener: (theme: PageTheme) => void): (() => void) => {
  if (typeof MutationObserver === "undefined" || typeof document === "undefined") return () => {}
  let current = pageTheme()
  const observer = new MutationObserver(() => {
    const next = pageTheme()
    if (next !== current) {
      current = next
      listener(next)
    }
  })
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
  return () => observer.disconnect()
}
