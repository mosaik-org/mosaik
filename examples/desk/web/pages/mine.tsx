import { Button } from "@mosaik/mosaik-ui"
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
      empty={{
        icon: <MessageCircle />,
        title: "You haven't asked for anything yet",
        description: "When you need help from IT, HR or Finance, send a request and follow it here.",
        action: <Button onClick={() => newRequest.open()}>New request</Button>,
      }}
    />
  )
}
