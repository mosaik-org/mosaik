import { InternalAuth } from "@mosaik/auth/contract"
import { NotFound, PlatformEventData, PlatformEventType, PrincipalUser, Unauthorized, UserId } from "@mosaik/core"
import { Schema } from "effect"
import { HttpApi, HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/http-api"
import { AppEventBatch, MAX_EVENTS_WAIT_SECONDS } from "./api"
import { RegistryGroup } from "./registry"

/** Where the gateway sends `/api/<id>/*`. */
export class AppRoute extends Schema.Class<AppRoute>("@mosaik/platform/AppRoute")({
  id: Schema.String,
  upstream: Schema.String,
}) {}

export const ROUTES_STREAM_PATH = "/internal/routes/stream"

export class RoutesGroup extends HttpApiGroup.make("routes")
  .add(
    /** Server-Sent Events: every app route, when connecting and after every change. */
    HttpApiEndpoint.get("stream", "/routes/stream", {
      success: Schema.String.pipe(HttpApiSchema.asText({ contentType: "text/event-stream" })),
    }),
  )
  .middleware(InternalAuth) {}

const eventFields = { id: Schema.String.check(Schema.isUUID()), occurredAt: Schema.DateTimeUtc }

/**
 * An event as a platform service reports it. `user.access_changed` carries all of the
 * user's grants; the platform narrows them to each app when the app fetches it.
 */
export const SourceEvent = Schema.Union([
  Schema.Struct({ ...eventFields, type: Schema.Literal("user.created"), data: Schema.Struct({ user: PrincipalUser }) }),
  Schema.Struct({ ...eventFields, type: Schema.Literal("user.deleted"), data: PlatformEventData["user.deleted"] }),
  Schema.Struct({
    ...eventFields,
    type: Schema.Literal("user.access_changed"),
    data: Schema.Struct({ userId: UserId, grants: Schema.Array(Schema.String) }),
  }),
])
export type SourceEvent = typeof SourceEvent.Type

/** A platform service that receives events, like an app does (e.g. `portal`). */
const serviceParams = { service: Schema.String.check(Schema.isPattern(/^[a-z][a-z0-9-]*$/)) }

export class EventsGroup extends HttpApiGroup.make("events")
  .add(
    /** Records events; ones already recorded (by id) are ignored, so retrying is safe. */
    HttpApiEndpoint.post("publish", "/events", {
      payload: Schema.Struct({ events: Schema.Array(SourceEvent).check(Schema.isMaxLength(500)) }),
      success: HttpApiSchema.NoContent,
    }),
    /**
     * A service's next events of these types, waiting up to `wait` seconds for new ones. It
     * starts receiving with its first call; its grants in `user.access_changed` are not narrowed.
     */
    HttpApiEndpoint.post("receive", "/events/services/:service", {
      params: serviceParams,
      payload: Schema.Struct({
        types: Schema.Array(PlatformEventType).check(Schema.isMinLength(1)),
        wait: Schema.Number.check(Schema.isBetween({ minimum: 0, maximum: MAX_EVENTS_WAIT_SECONDS })),
      }),
      success: AppEventBatch,
    }),
    HttpApiEndpoint.post("acknowledge", "/events/services/:service/ack", {
      params: serviceParams,
      payload: Schema.Struct({ position: Schema.Number, error: Schema.NullOr(Schema.String) }),
      success: HttpApiSchema.NoContent,
    }),
  )
  .middleware(InternalAuth) {}

/** An app as sign-in for standalone apps sees it. */
export class AppClient extends Schema.Class<AppClient>("@mosaik/platform/AppClient")({
  id: Schema.String,
  /** Where it serves its own page; sign-in returns only to addresses under it. `null`: not standalone. */
  publicUrl: Schema.NullOr(Schema.String),
}) {}

/** For the auth service: who an app is, when it signs people in on its own address. */
export class ClientsGroup extends HttpApiGroup.make("clients")
  .add(
    HttpApiEndpoint.get("get", "/clients/:id", { params: { id: Schema.String }, success: AppClient, error: NotFound }),
    /** The app a key belongs to, if the key is valid and the app not disabled. */
    HttpApiEndpoint.post("authenticate", "/clients/authenticate", {
      payload: Schema.Struct({ key: Schema.String }),
      success: AppClient,
      error: Unauthorized,
    }),
  )
  .middleware(InternalAuth) {}

/** Platform services only: the gateway, the auth service and the Portal. */
export class PlatformInternalApi extends HttpApi.make("platform-internal")
  .add(RoutesGroup, EventsGroup, RegistryGroup, ClientsGroup)
  .prefix("/internal") {}
