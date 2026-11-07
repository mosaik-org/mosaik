import { provideToaster } from "@mosaik/client"
import { Toaster, toaster } from "@mosaik/mosaik-ui"
import { onCleanup } from "solid-js"

/**
 * Renders the toasts of `toast` (`@mosaik/client`) and provides it to the page. The shell renders
 * it for the apps mounted in it; a standalone page renders it once, near its root.
 */
export const Toasts = () => {
  onCleanup(provideToaster({ show: (next) => toaster.create(next) }))
  return <Toaster />
}
