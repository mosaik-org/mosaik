import { sessionQueryOptions } from "@mosaik/auth/web"
import { consoleNav } from "@mosaik/console"
import { createFileRoute, redirect } from "@tanstack/solid-router"

/** The first section the principal may use. */
export const Route = createFileRoute("/_app/")({
  beforeLoad: async ({ context }) => {
    const { principal } = await context.queryClient.ensureQueryData(sessionQueryOptions())
    const first = consoleNav(principal)[0]
    if (first !== undefined) throw redirect({ to: first.to, replace: true })
  },
})
