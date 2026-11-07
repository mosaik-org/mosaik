import { AdminApi } from "@mosaik/auth/contract"
import { makeApiClient } from "@mosaik/client"
import { createApi } from "@mosaik/client/solid"
import { NotificationsApi } from "@mosaik/notifications/contract"
import { PlatformWebApi } from "@mosaik/platform/contract"

/** Users, roles and the audit log (the auth service). */
export const adminApi = makeApiClient(AdminApi)
/** The same API with queries keyed by the contract and calls for `useAction`. */
export const administration = createApi(AdminApi)
/** Notification channels, routing and deliveries (the notifications service). */
export const notificationsApi = makeApiClient(NotificationsApi)
/** Who can use apps, and requests for access (the platform service). */
export const platformApi = makeApiClient(PlatformWebApi)
