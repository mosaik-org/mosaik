import { AccessControl } from "@mosaik/core"
import { Schema } from "effect"
import { HttpApi, HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/http-api"
import { status } from "../manifest"

export const ServiceState = Schema.Literals(["up", "degraded", "down", "unknown"])
export type ServiceState = typeof ServiceState.Type

export class ServiceStatus extends Schema.Class<ServiceStatus>("@mosaik/status/ServiceStatus")({
  name: Schema.String,
  state: ServiceState,
  latencyMs: Schema.NullOr(Schema.Number),
  /** Latencies of the most recent checks, oldest first; `null` for failed checks. */
  history: Schema.Array(Schema.NullOr(Schema.Number)),
  checkedAt: Schema.NullOr(Schema.DateTimeUtc),
}) {}

export class StatusSnapshot extends Schema.Class<StatusSnapshot>("@mosaik/status/StatusSnapshot")({
  services: Schema.Array(ServiceStatus),
}) {}

export class ServicesGroup extends HttpApiGroup.make("services").add(
  HttpApiEndpoint.get("snapshot", "/services", { success: StatusSnapshot }),
  /** Server-Sent Events: a `StatusSnapshot` after every round of checks. */
  HttpApiEndpoint.get("live", "/services/live", {
    success: Schema.String.pipe(HttpApiSchema.asText({ contentType: "text/event-stream" })),
  }),
) {}

export class StatusApi extends HttpApi.make("status")
  .add(ServicesGroup)
  .prefix(status.apiPrefix)
  .middleware(AccessControl) {}

export const liveUrl = `${status.apiPrefix}/services/live`
