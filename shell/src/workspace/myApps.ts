import { usePrincipal } from "@mosaik/auth/web"
import { errorMessage, toast } from "@mosaik/client"
import type { AnyApp } from "@mosaik/core"
import { AppUsage, MAX_PINNED_APPS, MyApps } from "@mosaik/portal/contract"
import { useMutation, useQuery, useQueryClient } from "@tanstack/solid-query"
import { useLocation } from "@tanstack/solid-router"
import { DateTime } from "effect"
import { type Accessor, createEffect, createMemo, on } from "solid-js"
import { allApps, appForPath } from "../apps"
import { portalApi } from "../portalApi"
import { myAppsQuery, workspaceKeys } from "./queries"
import { affinities, move, recentApps, type Usage } from "./ranking"

/** Up to this many apps, navigation simply lists them all. */
export const FEW_APPS = 8

/** Recently used apps shown next to the pinned ones. */
export const RECENT_APPS = 5

export interface MyAppsState {
  /** Every app the principal may open. */
  readonly accessible: Accessor<ReadonlyArray<AnyApp>>
  /** Pinned apps the principal may open, in the user's order. */
  readonly pinned: Accessor<ReadonlyArray<AnyApp>>
  /** The most recently opened apps that are not pinned. */
  readonly recent: Accessor<ReadonlyArray<AnyApp>>
  /** Logged-in users keep pins (on the server, so they follow them across devices). */
  readonly canPin: Accessor<boolean>
  isPinned(id: string): boolean
  pin(id: string): void
  unpin(id: string): void
  /** Moves a pinned app up (negative) or down. */
  move(id: string, offset: number): void
  /** How much the user uses an app, from 0 (never opened) to 1 (pinned). */
  affinity(id: string): number
}

const toUsage = (data: MyApps | undefined): ReadonlyArray<Usage> =>
  (data?.usage ?? []).map((entry) => ({
    app: entry.app,
    opens: entry.opens,
    lastOpenedAt: DateTime.toEpochMillis(entry.lastOpenedAt),
  }))

/** The current user's apps: pinned, recently used, and how much each is used. */
export const useMyApps = (): MyAppsState => {
  const principal = usePrincipal()
  const queryClient = useQueryClient()
  const user = () => principal().user?.id
  const query = useQuery(() => ({ ...myAppsQuery(user() ?? ""), enabled: user() !== undefined }))

  const accessible = createMemo(() => allApps.filter((app) => principal().can(app.accessPermission)))
  const byId = createMemo(() => new Map(accessible().map((app) => [app.id, app])))
  const pinnedIds = (): ReadonlyArray<string> => query.data?.pinned ?? []
  const usage = createMemo(() => toUsage(query.data))
  const scores = createMemo(() => affinities(pinnedIds(), usage(), Date.now()))
  const lookup = (ids: ReadonlyArray<string>) => ids.flatMap((id) => byId().get(id) ?? [])

  const setPinned = useMutation(() => ({
    mutationFn: (apps: ReadonlyArray<string>) =>
      portalApi((client) => client.workspace.setPinned({ payload: { apps } })),
    // The list changes right away; the next change sends the whole list again, so the last one wins.
    onMutate: async (apps: ReadonlyArray<string>) => {
      const id = user()
      if (id === undefined) return
      await queryClient.cancelQueries({ queryKey: workspaceKeys.myApps(id) })
      queryClient.setQueryData<MyApps>(
        workspaceKeys.myApps(id),
        (current) => new MyApps({ pinned: apps, usage: current?.usage ?? [] }),
      )
    },
    onError: (error: unknown) => {
      toast.error("Could not save your pinned apps", errorMessage(error))
      void queryClient.invalidateQueries({ queryKey: workspaceKeys.all })
    },
  }))

  const save = (apps: ReadonlyArray<string>) => {
    if (apps.length > MAX_PINNED_APPS) {
      toast.error("Too many pinned apps", `You can pin up to ${MAX_PINNED_APPS} apps.`)
      return
    }
    setPinned.mutate(apps)
  }

  return {
    accessible,
    pinned: createMemo(() => lookup(pinnedIds())),
    recent: createMemo(() =>
      lookup(
        recentApps(
          usage().filter((entry) => byId().has(entry.app)),
          new Set(pinnedIds()),
          RECENT_APPS,
        ),
      ),
    ),
    canPin: () => user() !== undefined,
    isPinned: (id) => pinnedIds().includes(id),
    pin: (id) => {
      if (!pinnedIds().includes(id)) save([...pinnedIds(), id])
    },
    unpin: (id) => save(pinnedIds().filter((pinned) => pinned !== id)),
    move: (id, offset) => {
      // Apps the user can no longer open keep their place, so moving skips over them.
      const visible = pinnedIds().filter((pinned) => byId().has(pinned))
      const moved = move(visible, id, offset)
      const hidden = pinnedIds().filter((pinned) => !byId().has(pinned))
      save([...moved, ...hidden])
    },
    affinity: (id) => scores().get(id) ?? 0,
  }
}

/** The app this tab last reported: reloading one of its pages is not opening it again. */
const LAST_OPENED_KEY = "mosaik-last-opened-app"

const lastOpened = (): string | null => {
  try {
    return sessionStorage.getItem(LAST_OPENED_KEY)
  } catch {
    return null
  }
}

const setLastOpened = (app: string | undefined) => {
  try {
    if (app === undefined) sessionStorage.removeItem(LAST_OPENED_KEY)
    else sessionStorage.setItem(LAST_OPENED_KEY, app)
  } catch {
    // Without storage, a reload counts as opening the app again.
  }
}

/** Tells the platform each time the user goes into an app (recent apps, ranking, usage numbers). */
export const useRecordAppOpens = () => {
  const principal = usePrincipal()
  const location = useLocation()
  const queryClient = useQueryClient()
  // Changes only when the user goes into another app, not on every page.
  const current = createMemo(() => appForPath(location().pathname))

  createEffect(
    on(current, (app) => {
      const user = principal().user
      if (app === undefined || user === null || !principal().can(app.accessPermission)) {
        setLastOpened(undefined)
        return
      }
      if (lastOpened() === app.id) return
      setLastOpened(app.id)
      // Shown as recent right away; the count is the server's business.
      queryClient.setQueryData<MyApps>(workspaceKeys.myApps(user.id), (data) =>
        data === undefined
          ? data
          : new MyApps({
              pinned: data.pinned,
              usage: [
                new AppUsage({
                  app: app.id,
                  opens: (data.usage.find((entry) => entry.app === app.id)?.opens ?? 0) + 1,
                  lastOpenedAt: DateTime.nowUnsafe(),
                }),
                ...data.usage.filter((entry) => entry.app !== app.id),
              ],
            }),
      )
      portalApi((client) => client.workspace.opened({ params: { id: app.id } })).catch((error: unknown) =>
        console.warn("Could not record opening an app", error),
      )
    }),
  )
}
