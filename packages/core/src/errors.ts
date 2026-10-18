import { Schema } from "effect"

/** The request needs a logged-in user. */
export class Unauthorized extends Schema.TaggedError<Unauthorized>()(
  "Unauthorized",
  { message: Schema.String },
  { httpApiStatus: 401 },
) {}

/** The principal lacks the permission the endpoint requires. */
export class Forbidden extends Schema.TaggedError<Forbidden>()(
  "Forbidden",
  { permission: Schema.String },
  { httpApiStatus: 403 },
) {}

export class NotFound extends Schema.TaggedError<NotFound>()(
  "NotFound",
  { resource: Schema.String, id: Schema.String },
  { httpApiStatus: 404 },
) {}

export class Conflict extends Schema.TaggedError<Conflict>()(
  "Conflict",
  { message: Schema.String },
  { httpApiStatus: 409 },
) {}

export class BadRequest extends Schema.TaggedError<BadRequest>()(
  "BadRequest",
  { message: Schema.String },
  { httpApiStatus: 400 },
) {}

/** An external system an app depends on (Jira, a warehouse, ...) failed or is unreachable. */
export class UpstreamError extends Schema.TaggedError<UpstreamError>()(
  "UpstreamError",
  { source: Schema.String, message: Schema.String },
  { httpApiStatus: 502 },
) {}
