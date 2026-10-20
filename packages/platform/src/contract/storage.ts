import { AccessControl, Forbidden, NotFound } from "@mosaik/core"
import { Schema } from "effect"
import { HttpApiEndpoint, HttpApiGroup } from "effect/http-api"
import { AppId } from "./manifest"

/**
 * Why `key` cannot name a stored file, if it cannot. Keys are the app's own paths
 * (`orders/123/invoice.pdf`): segments separated by `/`, none empty, `.` or `..`, no control
 * characters or backslashes, at most 1,024 characters.
 */
export const storageKeyProblem = (key: string): string | undefined => {
  if (key.length === 0 || key.length > 1024) return "Between 1 and 1024 characters"
  // biome-ignore lint/suspicious/noControlCharactersInRegex: control characters are what it refuses
  if (/[\u0000-\u001f\u007f\\]/.test(key)) return "No control characters or backslashes"
  if (key.split("/").some((segment) => segment === "" || segment === "." || segment === ".."))
    return "Segments separated by /, none empty, . or .."
  return undefined
}

/** A stored file's name, the app's own path (see {@link storageKeyProblem}). */
export const StorageKey = Schema.String.check(
  Schema.makeFilter((key: string) => storageKeyProblem(key) ?? true, { title: "storage key" }),
)

/** A stored file, without its content. */
export class StoredObject extends Schema.Class<StoredObject>("@mosaik/platform/StoredObject")({
  key: Schema.String,
  /** In bytes. */
  size: Schema.Number,
  contentType: Schema.String,
  updatedAt: Schema.DateTimeUtc,
}) {}

export class StoredObjectsPage extends Schema.Class<StoredObjectsPage>("@mosaik/platform/StoredObjectsPage")({
  /** In key order. */
  objects: Schema.Array(StoredObject),
  /** Pass as `after` for the next page; `null` on the last. */
  next: Schema.NullOr(Schema.String),
}) {}

/** How much an app stores, and how much it may. */
export class StorageUsage extends Schema.Class<StorageUsage>("@mosaik/platform/StorageUsage")({
  app: AppId,
  usedBytes: Schema.Number,
  objects: Schema.Number,
  limitBytes: Schema.Number,
  /** The platform's default limit (`STORAGE_DEFAULT_LIMIT_GB`), not one an admin set for this app. */
  defaultLimit: Schema.Boolean,
}) {}

/** Storing the file would take the app over its limit; nothing was stored. */
export class StorageLimitReached extends Schema.TaggedError<StorageLimitReached>()(
  "StorageLimitReached",
  { limitBytes: Schema.Number, usedBytes: Schema.Number },
  { httpApiStatus: 507 },
) {}

/** The platform has no storage (`STORAGE_URL` is not set), or the app does not declare `storage`. */
export class StorageUnavailable extends Schema.TaggedError<StorageUnavailable>()(
  "StorageUnavailable",
  { message: Schema.String },
  { httpApiStatus: 503 },
) {}

const appParams = { id: AppId }

/** An app's storage, for the people who manage it: its usage, and its limit for admins. */
export class StorageGroup extends HttpApiGroup.make("storage")
  .add(
    /** `StorageUnavailable` when the app stores no files (or the platform has no storage). */
    HttpApiEndpoint.get("usage", "/apps/:id/storage", {
      params: appParams,
      success: StorageUsage,
      error: [NotFound, Forbidden, StorageUnavailable],
    }),
    /** Admins only; `null` goes back to the platform's default. Recorded in the audit log. */
    HttpApiEndpoint.put("setLimit", "/apps/:id/storage/limit", {
      params: appParams,
      payload: Schema.Struct({ limitBytes: Schema.NullOr(Schema.Number.check(Schema.isGreaterThanOrEqualTo(0))) }),
      success: StorageUsage,
      error: [NotFound, Forbidden, StorageUnavailable],
    }),
  )
  .middleware(AccessControl) {}
