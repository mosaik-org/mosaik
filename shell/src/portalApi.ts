import { makeApiClient } from "@mosaik/client"
import { PortalWebApi } from "@mosaik/portal/contract"

/** The Portal service's browser API: the app catalog, the user's apps, and app usage and categories. */
export const portalApi = makeApiClient(PortalWebApi)
