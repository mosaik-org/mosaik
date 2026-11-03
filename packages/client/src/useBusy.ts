import { type Accessor, createEffect, on, onCleanup } from "solid-js"
import { type BusyOptions, markBusy } from "./busy"

/**
 * Shows that the page is busy while `busy` is true (see {@link markBusy}), and ends with the
 * component, so it cannot be left on.
 *
 * @example
 * useBusy(() => upload.pending(), { label: "Uploading files", keepOpen: true })
 */
export const useBusy = (busy: Accessor<boolean>, options: BusyOptions | Accessor<BusyOptions>): void => {
  createEffect(
    on(busy, (now) => {
      if (!now) return
      onCleanup(markBusy(typeof options === "function" ? options() : options))
    }),
  )
}
