import { signInUrl } from "@mosaik/auth/contract"
import { sessionQueryOptions } from "@mosaik/auth/web"
import { createFileRoute, redirect, useParams } from "@tanstack/solid-router"
import { AssistantSearch, AssistantView } from "../../assistant/AssistantView"

/**
 * The assistant on a page of its own (`/assistant`, `/assistant/<conversation>`): for signed-in people.
 * The page is rendered here, not by the two routes under it: going from a new conversation to its
 * address (the first message starts it) keeps the page, and the reply it is receiving.
 */
export const Route = createFileRoute("/_app/assistant")({
  staticData: { title: "Assistant", keywords: ["ai", "chat", "assistant"], layout: "full" },
  validateSearch: AssistantSearch,
  beforeLoad: async ({ context, location }) => {
    const { principal } = await context.queryClient.ensureQueryData(sessionQueryOptions())
    if (!principal.isAuthenticated) throw redirect({ href: signInUrl(location.href), reloadDocument: true })
  },
  component: () => {
    // Hooks first: a prop is read later, outside the component, where the router is not found.
    const params = useParams({ strict: false })
    const search = Route.useSearch()
    return <AssistantView conversation={params().conversation ?? null} from={search().from} />
  },
})
