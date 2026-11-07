import { defineSearchProvider } from "@mosaik/web-sdk/portal"
import { requestNumber, STATUS_LABELS } from "../api"
import { desk } from "../manifest"
import { deskApi } from "./queries"

/** Finds requests by number or words from the command palette: whichever the person may see. */
export default defineSearchProvider({
  id: "desk-requests",
  group: "Requests",
  permission: desk.accessPermission,
  search: async (query) => {
    const page = await deskApi.requests.list.call({ query: { view: "visible", search: query, limit: 5 } })
    return page.rows.map((request) => ({
      id: String(request.id),
      title: `${requestNumber(request.id)} · ${request.title}`,
      subtitle: `${STATUS_LABELS[request.status]} · ${request.queueName}`,
      to: `/desk/all?open=${request.id}`,
    }))
  },
})
