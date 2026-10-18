import { makeApiClient } from "@mosaik/sdk/client"
import { keepPreviousData, queryOptions } from "@tanstack/solid-query"
import { IssuesApi, type IssuesSearch } from "../api"
import { issues } from "../manifest"

export const issuesApi = makeApiClient(IssuesApi)

export const issuesKeys = {
  all: [issues.id] as const,
  list: (search: IssuesSearch) => [issues.id, "list", search] as const,
  projects: [issues.id, "projects"] as const,
}

export const issuesQuery = (search: IssuesSearch) =>
  queryOptions({
    queryKey: issuesKeys.list(search),
    queryFn: () => issuesApi((client) => client.issues.list({ query: search })),
    placeholderData: keepPreviousData,
  })

export const projectsQuery = () =>
  queryOptions({
    queryKey: issuesKeys.projects,
    queryFn: () => issuesApi((client) => client.issues.projects()),
    staleTime: 10 * 60_000,
  })
