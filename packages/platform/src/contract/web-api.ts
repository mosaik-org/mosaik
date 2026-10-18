import { HttpApi } from "effect/http-api"
import { AccessGroup, AccessReviewGroup, AppsGroup } from "./access"

export const PLATFORM_WEB_PREFIX = "/api/platform"

/** Browser API of the platform service (through the gateway): who can use apps, and asking for access. */
export class PlatformWebApi extends HttpApi.make("platform-web")
  .add(AccessGroup, AccessReviewGroup, AppsGroup)
  .prefix(PLATFORM_WEB_PREFIX) {}
