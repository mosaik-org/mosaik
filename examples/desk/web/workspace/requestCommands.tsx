import type { Command } from "@mosaik/sdk/portal"
import type { ListNavigation } from "@mosaik/sdk/solid"
import type { RequestRow } from "../../api"
import type { RequestPaneHandle } from "../request/RequestPane"
import type { RequestPickers } from "./pickers"

interface Context {
  readonly list: ListNavigation<RequestRow>
  readonly pickers: RequestPickers
  readonly pane: () => RequestPaneHandle | undefined
  readonly forRequester: boolean
  readonly focusSearch: () => void
}

const LIST = "In the list"
const REQUEST = "On a request"

/**
 * What the keyboard does on a list of requests. They are commands, so each also shows in the palette and
 * in the shortcuts panel, and what someone may not do is simply not there.
 */
export const requestCommands = ({
  list,
  pickers,
  pane,
  forRequester,
  focusSearch,
}: Context): ReadonlyArray<Command> => {
  /** On what is marked if anything is, otherwise on where the person is. Nothing there, nothing happens. */
  const onTargets = (use: (rows: ReadonlyArray<RequestRow>) => void) => () => {
    const rows = list.targets()
    if (rows.length > 0) use(rows)
  }

  const moving: ReadonlyArray<Command> = [
    {
      id: "desk:next",
      title: "Next request",
      group: LIST,
      keys: ["j", "arrowdown"],
      repeats: true,
      unlisted: true,
      perform: () => list.move(1),
    },
    {
      id: "desk:previous",
      title: "Previous request",
      group: LIST,
      keys: ["k", "arrowup"],
      repeats: true,
      unlisted: true,
      perform: () => list.move(-1),
    },
    {
      id: "desk:search",
      title: "Search this list",
      group: LIST,
      keys: "/",
      unlisted: true,
      perform: focusSearch,
    },
    {
      id: "desk:back",
      title: "Go back a step",
      group: LIST,
      keys: "escape",
      unlisted: true,
      // One step at a time, so it is always safe to press: the selection, then back to the list.
      perform: () => {
        if (list.selected().size > 0) list.clearSelection()
        else list.focus()
      },
    },
    {
      id: "desk:open",
      title: "Go into the request",
      group: LIST,
      keys: "enter",
      unlisted: true,
      perform: () => pane()?.focus(),
    },
    {
      id: "desk:reply",
      title: "Reply",
      group: REQUEST,
      keys: "r",
      perform: () => pane()?.compose("reply"),
    },
  ]

  if (forRequester) return moving

  return [
    ...moving,
    {
      id: "desk:select",
      title: "Select",
      group: LIST,
      keys: "x",
      unlisted: true,
      perform: () => {
        const active = list.active()
        if (active !== undefined) list.toggle(active)
      },
    },
    {
      id: "desk:select-next",
      title: "Select and move down",
      group: LIST,
      keys: "shift+j",
      repeats: true,
      unlisted: true,
      perform: () => list.extend(1),
    },
    {
      id: "desk:select-previous",
      title: "Select and move up",
      group: LIST,
      keys: "shift+k",
      repeats: true,
      unlisted: true,
      perform: () => list.extend(-1),
    },
    {
      id: "desk:note",
      title: "Add an internal note",
      group: REQUEST,
      keys: "n",
      perform: () => pane()?.compose("note"),
    },
    { id: "desk:assign", title: "Assign…", group: REQUEST, keys: "a", perform: onTargets(pickers.assign) },
    { id: "desk:take", title: "Assign to me", group: REQUEST, keys: "i", perform: onTargets(pickers.assignToMe) },
    { id: "desk:status", title: "Change status…", group: REQUEST, keys: "s", perform: onTargets(pickers.status) },
    { id: "desk:priority", title: "Change priority…", group: REQUEST, keys: "p", perform: onTargets(pickers.priority) },
    { id: "desk:queue", title: "Move to queue…", group: REQUEST, keys: "q", perform: onTargets(pickers.queue) },
    {
      id: "desk:solve",
      title: "Mark as solved",
      group: REQUEST,
      keys: "e",
      perform: onTargets((rows) => pickers.setStatus(rows, "solved")),
    },
  ]
}
