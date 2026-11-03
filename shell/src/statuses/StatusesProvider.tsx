import { usePrincipal } from "@mosaik/auth/web"
import { busyMarks, onBusyChange, provideStatuses } from "@mosaik/client"
import { createEventStream } from "@mosaik/client/solid"
import { StatusSnapshot, statusesLiveUrl } from "@mosaik/platform/contract"
import { AppIcon, useCommands } from "@mosaik/web-kit"
import { useNavigate } from "@tanstack/solid-router"
import CircleDot from "lucide-solid/icons/circle-dot"
import {
  type Accessor,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  type JSX,
  onCleanup,
  useContext,
} from "solid-js"
import { appForPath } from "../apps"
import { useMyApps } from "../workspace/myApps"
import { describe, fromBusy, isCurrent, type ShownStatus, statusesAt, summarize, waitingCount } from "./model"

const StatusesContext = createContext<Accessor<ReadonlyArray<ShownStatus>>>(() => [])

/**
 * What the shell shows beside places in its navigation: the person's statuses, kept live (apps'
 * and Core's, those they may see), and the work going on in this tab. Also counts what waits in
 * the tab's title, and lists it all in the command palette ("Needs you").
 */
export const StatusesProvider = (props: { readonly children: JSX.Element }): JSX.Element => {
  const principal = usePrincipal()
  const apps = useMyApps()
  const navigate = useNavigate()
  const live = createEventStream(() => (principal().isAuthenticated ? statusesLiveUrl : undefined), StatusSnapshot)
  const [marks, setMarks] = createSignal(busyMarks())
  onCleanup(onBusyChange(setMarks))

  const statuses = createMemo(
    (): ReadonlyArray<ShownStatus> => [
      ...(live.data()?.statuses ?? []).filter((status) => isCurrent(status, apps.lastOpened)),
      ...marks().map(fromBusy),
    ],
  )

  // Apps' pages show what waits for the person there (`useStatus` in the SDK).
  createEffect(() =>
    provideStatuses(
      (live.data()?.statuses ?? []).map(({ key, description, value, link }) => ({ key, description, value, link })),
    ),
  )
  onCleanup(() => provideStatuses([]))

  // "(3) Mosaik": what waits shows on the tab, from any page.
  const title = document.title
  createEffect(() => {
    const waiting = waitingCount(statuses())
    document.title = waiting > 0 ? `(${waiting}) ${title}` : title
  })
  onCleanup(() => {
    document.title = title
  })

  useCommands(() =>
    statuses().map((status) => {
      const app = appForPath(status.path)
      return {
        id: `status:${status.key}`,
        title: describe(status),
        group: "Needs you",
        ...(app === undefined ? {} : { hint: app.name }),
        icon: app === undefined ? <CircleDot size={16} /> : <AppIcon name={app.portal.icon} size={16} />,
        keywords: ["what needs me", "waiting", "status", status.description],
        perform: () => navigate({ href: status.link }),
      }
    }),
  )

  return <StatusesContext.Provider value={statuses}>{props.children}</StatusesContext.Provider>
}

/** Every status the person sees now. */
export const useStatuses = (): Accessor<ReadonlyArray<ShownStatus>> => useContext(StatusesContext)

/** What the statuses of a place come to (with `below`, the places under it too). */
export const useStatusSummary = (path: Accessor<string>, below: Accessor<boolean>) => {
  const statuses = useStatuses()
  return createMemo(() => summarize(statusesAt(statuses(), path(), { below: below() })))
}
