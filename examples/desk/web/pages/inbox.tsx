import { useCan } from "@mosaik/sdk/solid"
import { Navigate } from "@tanstack/solid-router"
import CheckCheck from "lucide-solid/icons/check-check"
import { Show } from "solid-js"
import { desk } from "../../manifest"
import { Workspace } from "../workspace/Workspace"

/** What is the person's to do. Someone who only sends requests has none: their page is My requests. */
export default function Inbox() {
  const can = useCan()
  return (
    <Show when={can(desk.perm("requests.work"))} fallback={<Navigate to="/desk/mine" replace />}>
      <Workspace
        view="inbox"
        label="Inbox"
        grouped
        empty={{
          icon: <CheckCheck />,
          title: "Nothing needs you right now",
          description: "New requests, and those given to you, show up here.",
        }}
      />
    </Show>
  )
}
