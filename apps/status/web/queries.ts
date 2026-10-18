import { makeApiClient } from "@mosaik/client"
import { queryOptions } from "@tanstack/solid-query"
import { StatusApi } from "../api"
import { status } from "../manifest"

export const statusApi = makeApiClient(StatusApi)

export const snapshotQuery = () =>
  queryOptions({
    queryKey: [status.id, "snapshot"] as const,
    queryFn: () => statusApi((client) => client.services.snapshot()),
  })
