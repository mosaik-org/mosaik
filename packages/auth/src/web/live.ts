import { createEventStream } from "@mosaik/client/solid"
import { useQuery, useQueryClient } from "@tanstack/solid-query"
import { Equal } from "effect"
import { createEffect, on, onCleanup } from "solid-js"
import { AccessChange, IDENTITY_LIVE_PATH } from "../contract"
import { sessionQueryOptions } from "./session"

/** A change for everyone reaches every browser at once: their reloads spread over this long. */
const SPREAD_MS = 2000

/**
 * Keeps the session current: when the user's access changes (an owner gave them a role,
 * an admin changed one, a session ended), it loads again, so apps appear or go away at
 * once. `onChange` refreshes what else depends on access, and runs only when it changed.
 *
 * The stream opens with a change for everyone (whatever happened before it connected is
 * unknown), and a broadcast change may not concern this user: each costs a reload of the
 * session, and nothing more when the principal comes back the same.
 */
export const useLiveAccess = (onChange?: () => void): void => {
  const queryClient = useQueryClient()
  const session = useQuery(sessionQueryOptions)
  // Per user, once the session says who that is: the stream knows who connected, so it
  // connects again after logging in or out (and not first as a visitor while loading).
  const live = createEventStream(() => {
    if (session.data === undefined) return undefined
    return `${IDENTITY_LIVE_PATH}?as=${encodeURIComponent(session.data.principal.user?.id ?? "visitor")}`
  }, AccessChange)
  const timers = new Set<ReturnType<typeof setTimeout>>()
  onCleanup(() => {
    for (const timer of timers) clearTimeout(timer)
  })

  const reload = async () => {
    const before = queryClient.getQueryData(sessionQueryOptions().queryKey)?.principal
    const after = (await queryClient.fetchQuery({ ...sessionQueryOptions(), staleTime: 0 })).principal
    if (!Equal.equals(before, after)) onChange?.()
  }

  createEffect(
    on(live.data, (change) => {
      if (change === undefined) return
      const timer = setTimeout(
        () => {
          timers.delete(timer)
          void reload()
        },
        change.user === null ? Math.random() * SPREAD_MS : 0,
      )
      timers.add(timer)
    }),
  )
}
