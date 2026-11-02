import { createFileRoute } from "@tanstack/solid-router"
import { AssistantSearch, AssistantView } from "../../assistant/AssistantView"

export const Route = createFileRoute("/_app/assistant/")({
  validateSearch: AssistantSearch,
  component: () => {
    // Hooks first: a prop is read later, outside the component, where the router is not found.
    const search = Route.useSearch()
    return <AssistantView conversation={null} from={search().from} />
  },
})
