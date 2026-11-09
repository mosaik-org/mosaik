import { Button, EmptyState } from "@mosaik/ui"
import MessageCircle from "lucide-solid/icons/message-circle"
import { useDesk } from "../context"
import { Workspace } from "../workspace/Workspace"

/** What the person has asked for, and where each stands. */
export default function Mine() {
  const { newRequest } = useDesk()
  return (
    <Workspace
      view="mine"
      label="My requests"
      withState
      forRequester
      empty={
        <EmptyState.Root>
          <EmptyState.Indicator>
            <MessageCircle />
          </EmptyState.Indicator>
          <EmptyState.Content>
            <EmptyState.Title>You haven't asked for anything yet</EmptyState.Title>
            <EmptyState.Description>
              When you need help from IT, HR or Finance, send a request and follow it here.
            </EmptyState.Description>
          </EmptyState.Content>
          <EmptyState.Actions>
            <Button onClick={() => newRequest.open()}>New request</Button>
          </EmptyState.Actions>
        </EmptyState.Root>
      }
    />
  )
}
