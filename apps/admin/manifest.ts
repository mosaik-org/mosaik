import { admin as administration } from "@mosaik/auth/contract"
import { withPortal } from "@mosaik/core"

/**
 * The Administration app: Core's administration (users, roles, notifications, the audit log,
 * served by the auth and notifications services) plus the Portal's pages for apps.
 */
export const admin = withPortal(administration, { icon: "shield", category: "Administration" })

export default admin
