import { toast } from "@mosaik/sdk/client"
import { createEventStream, useCan, usePrincipal } from "@mosaik/sdk/solid"
import { useCommands } from "@mosaik/web-sdk/portal"
import { useQuery, useQueryClient } from "@tanstack/solid-query"
import { useNavigate } from "@tanstack/solid-router"
import { type Accessor, createContext, createEffect, createSignal, on, type ParentProps, useContext } from "solid-js"
import { type DeadlineRule, type Person, type Queue, RequestsChanged } from "../api"
import { desk } from "../manifest"
import { NewRequestDialog } from "./NewRequest"
import { Picker, type PickerControl } from "./Picker"
import { agentsQuery, deadlinesQuery, deskApi, liveUrl, queuesQuery } from "./queries"
import { createRequestActions, type RequestActions } from "./requestActions"

/** What every page of the desk works with. */
export interface Desk {
  readonly me: Accessor<string>
  /** They work on requests, rather than only sending their own. */
  readonly isAgent: Accessor<boolean>
  readonly mayDelete: Accessor<boolean>
  readonly queues: Accessor<ReadonlyArray<Queue>>
  readonly agents: Accessor<ReadonlyArray<Person>>
  readonly deadlines: Accessor<ReadonlyArray<DeadlineRule>>
  readonly actions: RequestActions
  readonly picker: PickerControl
  readonly newRequest: { readonly open: () => void }
}

const DeskContext = createContext<Desk>()

export const useDesk = (): Desk => {
  const value = useContext(DeskContext)
  if (value === undefined) throw new Error("useDesk must be used inside <DeskProvider>")
  return value
}

/** Refetches what changed as it changes, whoever changed it: another agent's reply, the desk closing something. */
const useLiveRequests = () => {
  const client = useQueryClient()
  const live = createEventStream(liveUrl, RequestsChanged)
  createEffect(
    on(
      live.data,
      (changed) => {
        if (changed === undefined) return
        void client.invalidateQueries({ queryKey: deskApi.requests.key() })
      },
      { defer: true },
    ),
  )
}

export const DeskProvider = (props: ParentProps) => {
  const principal = usePrincipal()
  const can = useCan()
  const navigate = useNavigate()
  const isAgent = () => can(desk.perm("requests.work"))
  const me = () => principal().user?.id ?? ""

  const queues = useQuery(queuesQuery)
  const agents = useQuery(() => ({ ...agentsQuery(), enabled: isAgent() }))
  const deadlines = useQuery(() => ({ ...deadlinesQuery(), enabled: isAgent() }))
  const [newRequestOpen, setNewRequestOpen] = createSignal(false)
  const [picker, setPicker] = createSignal<PickerControl>()

  const value: Desk = {
    me,
    isAgent,
    mayDelete: () => can(desk.perm("requests.delete")),
    queues: () => queues.data ?? [],
    agents: () => agents.data ?? [],
    deadlines: () => deadlines.data ?? [],
    actions: createRequestActions({
      me,
      queues: () => queues.data ?? [],
      agents: () => agents.data ?? [],
      deadlines: () => deadlines.data ?? [],
    }),
    picker: { open: (request) => picker()?.open(request) },
    newRequest: { open: () => setNewRequestOpen(true) },
  }

  useLiveRequests()

  const go = (to: string) => () => void navigate({ to: `/desk${to}` })
  useCommands(() => [
    {
      id: "desk:new",
      title: "New request",
      group: "Service Desk",
      keys: "c",
      keywords: ["ask", "help", "ticket", "create"],
      perform: () => setNewRequestOpen(true),
    },
    ...(isAgent()
      ? [
          { id: "desk:go:inbox", title: "Go to Inbox", group: "Go to", keys: "g i", unlisted: true, perform: go("") },
          {
            id: "desk:go:all",
            title: "Go to All requests",
            group: "Go to",
            keys: "g a",
            unlisted: true,
            perform: go("/all"),
          },
        ]
      : []),
    {
      id: "desk:go:mine",
      title: "Go to My requests",
      group: "Go to",
      keys: "g m",
      unlisted: true,
      perform: go("/mine"),
    },
    ...(can(desk.perm("configure"))
      ? [
          {
            id: "desk:go:setup",
            title: "Go to Setup",
            group: "Go to",
            keys: "g s",
            unlisted: true,
            perform: go("/setup"),
          },
        ]
      : []),
    {
      id: "desk:undo",
      title: "Undo",
      group: "Service Desk",
      keys: "mod+z",
      unlisted: true,
      perform: () => {
        if (!value.actions.undoLast()) toast.info("Nothing to undo")
      },
    },
  ])

  return (
    <DeskContext.Provider value={value}>
      {props.children}
      <Picker ref={setPicker} />
      <NewRequestDialog open={newRequestOpen()} onOpenChange={setNewRequestOpen} />
    </DeskContext.Provider>
  )
}
