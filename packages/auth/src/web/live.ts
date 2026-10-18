import { createEventStream } from "@mosaik/client/solid"
import { useQueryClient } from "@tanstack/solid-query"
import { createEffect, on, onCleanup } from "solid-js"
import { AccessChange, IDENTITY_LIVE_PATH } from "../contract"
import { usePrincipal } from "./hooks"
import { SESSION_QUERY_KEY } from "./session"

/** A change for everyone reaches every browser at once: their reloads spread over this long. */
const SPREAD_MS = 2000

/**
 * Keeps the session current: when the user's access changes (an owner gave them a role,
 * an admin changed one, a session ended), it loads again, so apps appear or go away at
 * once. `onChange` refreshes what else depends on access.
 */
export const useLiveAccess = (onChange?: () => void): void => {
  const queryClient = useQueryClient()
  const principal = usePrincipal()
  // Per user: the stream knows who connected, so it reconnects after logging in or out.
  const live = createEventStream(
    () => `${IDENTITY_LIVE_PATH}?as=${encodeURIComponent(principal().user?.id ?? "visitor")}`,
    AccessChange,
  )
  const timers = new Set<ReturnType<typeof setTimeout>>()
  onCleanup(() => {
    for (const timer of timers) clearTimeout(timer)
  })

  createEffect(
    on(live.data, (change) => {
      if (change === undefined) return
      const timer = setTimeout(
        () => {
          timers.delete(timer)
          void queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY })
          onChange?.()
        },
        change.user === null ? Math.random() * SPREAD_MS : 0,
      )
      timers.add(timer)
    }),
  )
}
