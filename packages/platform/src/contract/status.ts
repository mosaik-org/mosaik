import { InternalAuth } from "@mosaik/auth/contract"
import {
  AccessControl,
  BadRequest,
  Principal,
  StatusAudience,
  StatusKind,
  type StatusSpec,
  StatusTone,
  StatusValue,
} from "@mosaik/core"
import { Schema } from "effect"
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/http-api"

/** Who sets a status: an app (its id), or Core itself. */
export const CORE_STATUS_OWNER = "core"

/** Core's own statuses: where they show in the shell, by name. */
export const CoreStatuses = {
  /** Requests for access to the apps someone decides about (computed by the platform). */
  "access.requests": {
    description: "Access requests waiting for your answer",
    kind: "count",
    path: "/access-requests",
  },
  /** Changes the assistant waits for the person to allow or deny (set by the assistant). */
  "assistant.approvals": {
    description: "Changes the assistant is waiting for you to allow",
    kind: "count",
    path: "/assistant",
  },
} as const satisfies Record<string, Pick<StatusSpec, "description" | "kind"> & { readonly path: string }>

export type CoreStatusName = keyof typeof CoreStatuses
export const CoreStatusName = Schema.Literals(Object.keys(CoreStatuses) as Array<CoreStatusName>)

/** Running work disappears unless it is set again within this time (the app stopped, or crashed). */
export const RUNNING_STATUS_TTL_SECONDS = 300

/** A status as a person sees it: what it says, and where in the shell it belongs. */
export class PersonStatus extends Schema.Class<PersonStatus>("@mosaik/platform/PersonStatus")({
  /** `<owner>:<name>`, e.g. `sales:orders.pending` or `core:access.requests`. */
  key: Schema.String,
  /** The app it is about; `null` for Core's own. */
  app: Schema.NullOr(Schema.String),
  description: Schema.String,
  kind: StatusKind,
  tone: StatusTone,
  /** The shell's path it belongs to: an app (`/sales`), one of its pages (`/sales/orders`) or Core's. */
  path: Schema.String,
  /** Where the things it is about are (`/sales/orders?status=pending`, one conversation): its page otherwise. */
  link: Schema.String,
  value: StatusValue,
  updatedAt: Schema.DateTimeUtc,
}) {}

/** Sent on the live stream: everything the person should see now, when connecting and on each change. */
export class StatusSnapshot extends Schema.Class<StatusSnapshot>("@mosaik/platform/StatusSnapshot")({
  statuses: Schema.Array(PersonStatus),
}) {}

/** Where a status leads: a path, under the app's address for an app's (`/orders?status=pending`). */
export const StatusLink = Schema.String.check(Schema.isStartingWith("/"), Schema.isMaxLength(500))

/** One value of a status: for whom, what it says (`null` clears it), and where it leads (`null`: its page). */
export const StatusEntry = Schema.Struct({
  audience: StatusAudience,
  value: Schema.NullOr(StatusValue),
  link: Schema.NullOr(StatusLink),
})
export type StatusEntry = typeof StatusEntry.Type

const statusParams = { name: Schema.String }

/**
 * Setting the calling app's statuses (declared in its manifest). Values are for its own permissions
 * or for people; work running expires unless set again within `RUNNING_STATUS_TTL_SECONDS`.
 */
export const setStatusEndpoint = HttpApiEndpoint.put("setStatus", "/statuses/:name", {
  params: statusParams,
  payload: StatusEntry,
  success: HttpApiSchema.NoContent,
  error: BadRequest,
})

/** Every value of a status at once: the ones not listed are cleared (recomputing never leaves stale ones). */
export const replaceStatusEndpoint = HttpApiEndpoint.put("replaceStatus", "/statuses/:name/all", {
  params: statusParams,
  payload: Schema.Struct({ entries: Schema.Array(StatusEntry) }),
  success: HttpApiSchema.NoContent,
  error: BadRequest,
})

/** The person's statuses, for the shell: every app's they may see, and Core's. */
export class StatusesGroup extends HttpApiGroup.make("statuses")
  .add(
    HttpApiEndpoint.get("mine", "/me/statuses", { success: Schema.Array(PersonStatus) }),
    /** Server-Sent Events of `StatusSnapshot`. */
    HttpApiEndpoint.get("live", "/me/statuses/live", {
      success: Schema.String.pipe(HttpApiSchema.asText({ contentType: "text/event-stream" })),
    }),
  )
  .middleware(AccessControl) {}

/** For Core's services: a person's statuses (the assistant tells its AI), and Core's own to set. */
export class StatusesInternalGroup extends HttpApiGroup.make("statuses")
  .add(
    HttpApiEndpoint.post("forPrincipal", "/statuses/for", {
      payload: Schema.Struct({ principal: Principal }),
      success: Schema.Array(PersonStatus),
    }),
    HttpApiEndpoint.put("setCore", "/statuses/core/:name", {
      params: { name: CoreStatusName },
      payload: StatusEntry,
      success: HttpApiSchema.NoContent,
      error: BadRequest,
    }),
  )
  .middleware(InternalAuth) {}
