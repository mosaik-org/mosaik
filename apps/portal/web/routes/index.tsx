import { createFileRoute, redirect } from "@tanstack/solid-router"

export const Route = createFileRoute("/_app/portal/")({
  beforeLoad: () => {
    throw redirect({ to: "/portal/apps", replace: true })
  },
})
