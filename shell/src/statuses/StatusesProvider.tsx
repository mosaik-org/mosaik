import { usePrincipal } from "@mosaik/auth/web"
import { busyMarks, onBusyChange, type PageStatus, provideStatuses } from "@mosaik/client"
import { createEventStream } from "@mosaik/client/solid"
import { statusSentence } from "@mosaik/core"
import { StatusSnapshot, statusesLiveUrl } from "@mosaik/platform/contract"
import { AppIcon, useCommands } from "@mosaik/web-kit"
import { useNavigate } from "@tanstack/solid-router"
import CircleDot from "lucide-solid/icons/circle-dot"
import { createEffect, createMemo, createSignal, type JSX, onCleanup } from "solid-js"
import { appForPath } from "../apps"
import { useMyApps } from "../workspace/myApps"
import { fromBusy, fromStatus, isCurrent, waitingCount } from "./model"

/**
 * What the shell shows beside places in its navigation: the person's statuses, kept live (apps'
 * and Core's, those they may see), and the work going on in this tab. It provides them to
 * everything that shows them (`usePageStatuses`: the sidebar, All apps, the Overview, the app's
 * tabs, apps' own pages), counts what waits in the tab's title, and lists it all in the command
 * palette ("Needs you").
 */
export const StatusesProvider = (props: { readonly children: JSX.Element }): JSX.Element => {
  const principal = usePrincipal()
  const apps = useMyApps()
  const navigate = useNavigate()
  const live = createEventStream(() => (principal().isAuthenticated ? statusesLiveUrl : undefined), StatusSnapshot)
  const [marks, setMarks] = createSignal(busyMarks())
  onCleanup(onBusyChange(setMarks))

  const statuses = createMemo(
    (): ReadonlyArray<PageStatus> => [
      ...(live.data()?.statuses ?? []).filter((status) => isCurrent(status, apps.lastOpened)).map(fromStatus),
      ...marks().map(fromBusy),
    ],
  )
  createEffect(() => provideStatuses(statuses()))
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
        title: statusSentence(status),
        group: "Needs you",
        ...(app === undefined ? {} : { hint: app.name }),
        icon: app === undefined ? <CircleDot size={16} /> : <AppIcon name={app.portal.icon} size={16} />,
        keywords: ["what needs me", "waiting", "status", status.description],
        perform: () => navigate({ href: status.link }),
      }
    }),
  )

  return props.children
}
