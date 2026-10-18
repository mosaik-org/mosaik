import { type Accessor, createEffect, createSignal, getOwner, on, onCleanup } from "solid-js"

/** Follows `source` after it has been stable for `ms` milliseconds (e.g. search inputs). */
export const createDebounced = <T>(source: Accessor<T>, ms: number): Accessor<T> => {
  const [value, setValue] = createSignal<T>(source())
  createEffect(
    on(
      source,
      (next) => {
        const timer = setTimeout(() => setValue(() => next), ms)
        onCleanup(() => clearTimeout(timer))
      },
      { defer: true },
    ),
  )
  return value
}

const TICK_MS = 5_000
const [now, setNow] = createSignal(Date.now())
let subscribers = 0
let timer: ReturnType<typeof setInterval> | undefined

/**
 * The current time, updated every few seconds by one shared timer (however many
 * components use it), for relative timestamps like "updated 2 minutes ago".
 */
export const useNow = (): Accessor<number> => {
  if (getOwner() === null) return now
  if (subscribers++ === 0) {
    setNow(Date.now())
    timer = setInterval(() => setNow(Date.now()), TICK_MS)
  }
  onCleanup(() => {
    if (--subscribers === 0) clearInterval(timer)
  })
  return now
}
