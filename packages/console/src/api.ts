import { AdminApi } from "@mosaik/auth/contract"
import { makeApiClient } from "@mosaik/client"
import { NotificationsApi } from "@mosaik/notifications/contract"
import { PlatformWebApi } from "@mosaik/platform/contract"

/** Users, roles and the audit log (the auth service). */
export const adminApi = makeApiClient(AdminApi)
/** Notification channels, routing and deliveries (the notifications service). */
export const notificationsApi = makeApiClient(NotificationsApi)
/** Who can use apps, and requests for access (the platform service). */
export const platformApi = makeApiClient(PlatformWebApi)
