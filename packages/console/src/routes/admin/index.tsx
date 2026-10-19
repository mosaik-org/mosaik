import { admin } from "@mosaik/auth/contract"
import { sessionQueryOptions } from "@mosaik/auth/web"
import { createFileRoute, redirect } from "@tanstack/solid-router"

export const Route = createFileRoute("/_app/admin/")({
  beforeLoad: async ({ context }) => {
    const { principal } = await context.queryClient.ensureQueryData(sessionQueryOptions())
    throw redirect({ to: principal.can(admin.perm("users.manage")) ? "/admin/users" : "/admin/roles", replace: true })
  },
})
