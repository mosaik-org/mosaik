import { makeApiClient } from "@mosaik/client"
import { Principal } from "@mosaik/core"
import { queryOptions } from "@tanstack/solid-query"
import { IdentityApi, type SessionInfo } from "../contract/identity"

const identityApi = makeApiClient(IdentityApi)

export const SESSION_QUERY_KEY = ["mosaik", "session"] as const

/** The principal used before the session has loaded (and for logged-out visitors without grants). */
export const ANONYMOUS = new Principal({ user: null, grants: [] })

/** Current principal + enabled login providers. Refreshed on focus so permission changes show up. */
export const sessionQueryOptions = () =>
  queryOptions<SessionInfo>({
    queryKey: SESSION_QUERY_KEY,
    queryFn: () => identityApi((client) => client.identity.session()),
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  })
