import { AppLayout } from "@mosaik/frame"
import { createFileRoute } from "@tanstack/solid-router"
import { portal } from "../../manifest"

export const Route = createFileRoute("/_app/portal")({
  component: () => <AppLayout app={portal} />,
})
