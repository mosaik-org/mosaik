import { AppLayout } from "@mosaik/web-kit"
import { createFileRoute } from "@tanstack/solid-router"
import { status } from "../../manifest"

export const Route = createFileRoute("/_app/status")({
  component: () => <AppLayout app={status} />,
})
