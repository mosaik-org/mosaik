import { makeApiClient } from "@mosaik/client"
import { PlatformWebApi } from "@mosaik/platform/contract"

/** Core's platform service, browser API: who can use apps, and requests for access. */
export const platformApi = makeApiClient(PlatformWebApi)
