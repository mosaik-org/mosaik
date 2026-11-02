import { signInUrl } from "@mosaik/auth/contract"
import { sessionQueryOptions } from "@mosaik/auth/web"
import { createFileRoute, Outlet, redirect } from "@tanstack/solid-router"

/** The assistant on a page of its own (`/assistant`, `/assistant/<conversation>`): for signed-in people. */
export const Route = createFileRoute("/_app/assistant")({
  staticData: { title: "Assistant", keywords: ["ai", "chat", "assistant"], layout: "full" },
  beforeLoad: async ({ context, location }) => {
    const { principal } = await context.queryClient.ensureQueryData(sessionQueryOptions())
    if (!principal.isAuthenticated) throw redirect({ href: signInUrl(location.href), reloadDocument: true })
  },
  component: Outlet,
})
