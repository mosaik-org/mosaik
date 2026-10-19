import { HttpApi } from "effect/http-api"
import { AccessGroup, AccessReviewGroup, AppsGroup } from "./access"

export const PLATFORM_WEB_PREFIX = "/api/platform"

/** Browser API of the platform service (through the gateway): who can use apps, and asking for access. */
export class PlatformWebApi extends HttpApi.make("platform-web")
  .add(AccessGroup, AccessReviewGroup, AppsGroup)
  .prefix(PLATFORM_WEB_PREFIX) {}

/**
 * Core's page for asking for access to an app, for anyone signed in (rendered by the platform
 * service, so it works without the Portal). `return`: where to go back to, a path on Core's
 * origin or an address under a standalone app's own.
 */
export const REQUEST_ACCESS_PATH = `${PLATFORM_WEB_PREFIX}/request-access`

export const requestAccessUrl = (app: string, returnTo?: string): string =>
  `${REQUEST_ACCESS_PATH}/${encodeURIComponent(app)}${returnTo === undefined ? "" : `?${new URLSearchParams({ return: returnTo })}`}`
