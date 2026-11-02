import { createFileRoute } from "@tanstack/solid-router"
import { AssistantSearch, AssistantView } from "../../assistant/AssistantView"

export const Route = createFileRoute("/_app/assistant/$conversation")({
  validateSearch: AssistantSearch,
  component: () => {
    const params = Route.useParams()
    const search = Route.useSearch()
    return <AssistantView conversation={params().conversation} from={search().from} />
  },
})
