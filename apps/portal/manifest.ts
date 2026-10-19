import { withPortal } from "@mosaik/core"
import { portalApp } from "@mosaik/portal/contract"

/** The Portal's own pages: installing and running apps, and how much they are used. */
export const portal = withPortal(portalApp, { icon: "package", category: "Administration" })

export default portal
