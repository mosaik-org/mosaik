import { createApi } from "@mosaik/sdk/solid"
import { keepPreviousData } from "@tanstack/solid-query"
import { DeskApi, type RequestId, type RequestsQuery } from "../api"
import { desk } from "../manifest"

/** The API for the pages: queries keyed by the contract, and calls. */
export const deskApi = createApi(DeskApi)

// While the next list loads, the current one stays: moving between queues does not blink.
export const requestsQuery = (query: RequestsQuery) => ({
  ...deskApi.requests.list.query({ query }),
  placeholderData: keepPreviousData,
})

export const requestQuery = (id: RequestId) => deskApi.requests.get.query({ params: { id } })
export const activityQuery = (id: RequestId) => deskApi.requests.activity.query({ params: { id } })
export const attachmentsQuery = (id: RequestId) => deskApi.requests.attachments.query({ params: { id } })

export const queuesQuery = () => deskApi.directory.queues.query()
export const agentsQuery = () => deskApi.directory.agents.query()
export const deadlinesQuery = () => deskApi.directory.deadlines.query()
export const savedRepliesQuery = () => deskApi.directory.savedReplies.query()

export const liveUrl = `${desk.apiPrefix}/requests/live`

export const attachmentUrl = (id: RequestId, name: string, inline = false) =>
  `${desk.apiPrefix}/requests/${id}/attachments/${encodeURIComponent(name)}${inline ? "?inline=true" : ""}`

export const attachUrl = (id: RequestId) => `${desk.apiPrefix}/requests/${id}/attachments`
