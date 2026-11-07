import { admin } from "@mosaik/auth/contract"
import { AppLayout } from "@mosaik/frame"
import { createFileRoute } from "@tanstack/solid-router"

/** Core's administration: users, roles, notification channels, the audit log and AI clients (its pages: its manifest). */
export const Route = createFileRoute("/_app/admin")({
  component: () => <AppLayout app={admin} />,
})
