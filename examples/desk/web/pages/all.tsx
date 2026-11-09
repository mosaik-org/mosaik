import { useCan } from "@mosaik/sdk/solid"
import { EmptyState } from "@mosaik/ui"
import { Navigate } from "@tanstack/solid-router"
import Inbox from "lucide-solid/icons/inbox"
import { Show } from "solid-js"
import { desk } from "../../manifest"
import { Workspace } from "../workspace/Workspace"

/** Everything on the desk: what is being worked on, or what is done. */
export default function All() {
  const can = useCan()
  return (
    <Show when={can(desk.perm("requests.work"))} fallback={<Navigate to="/desk/mine" replace />}>
      <Workspace
        view="all"
        label="All requests"
        grouped
        withState
        empty={
          <EmptyState.Root>
            <EmptyState.Indicator>
              <Inbox />
            </EmptyState.Indicator>
            <EmptyState.Content>
              <EmptyState.Title>No requests here</EmptyState.Title>
              <EmptyState.Description>Try another queue, or clear the search.</EmptyState.Description>
            </EmptyState.Content>
          </EmptyState.Root>
        }
      />
    </Show>
  )
}
