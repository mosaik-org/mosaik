import { provideToaster } from "@mosaik/client"
import { createToaster, Toaster } from "@mosaik/ui"
import { onCleanup } from "solid-js"

/**
 * Mosaik's own toaster rather than the library's: apps reach it only through `toast`, and a page
 * left open shows at most five, paused while nobody is looking, so none goes by unread.
 */
const toaster = createToaster({ placement: "bottom-end", overlap: true, gap: 12, max: 5, pauseOnPageIdle: true })

/**
 * Renders the toasts of `toast` (`@mosaik/client`) and provides it to the page. The shell renders
 * it for the apps mounted in it; a standalone page renders it once, near its root.
 */
export const Toasts = () => {
  onCleanup(provideToaster({ show: (next) => toaster.create(next) }))
  return <Toaster toaster={toaster} />
}
