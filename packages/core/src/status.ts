import { Schema } from "effect"
import { PermissionKey } from "./permission"
import { UserId } from "./principal"

/**
 * What a status says about an app, for the people it concerns:
 * - `count`: things waiting for them (orders to approve, requests to answer): a number;
 * - `new`: something new since they last opened the app: a dot;
 * - `running`: work the app is doing for them (an import, a sync), with its progress when known;
 * - `health`: the app does not work as it should (degraded, in maintenance).
 */
export const StatusKind = Schema.Literals(["count", "new", "running", "health"])
export type StatusKind = typeof StatusKind.Type

/** How much a status asks for attention: `attention` (the default), `warning` or `danger`. */
export const StatusTone = Schema.Literals(["attention", "warning", "danger"])
export type StatusTone = typeof StatusTone.Type

/** A status an app declares in its manifest (`statuses`): what it is and where it shows. */
export interface StatusSpec {
  /** Says what it counts or tracks, e.g. "Orders waiting for approval". */
  readonly description: string
  readonly kind: StatusKind
  /** The app's page it belongs to (`/orders`, see `portal.pages`); the app itself otherwise. */
  readonly page?: string
  /** Defaults to `attention`; a `health` status says its own (`warning` or `danger`). */
  readonly tone?: StatusTone
}

export type StatusesSpec = { readonly [name: string]: StatusSpec }
export type NoStatuses = Record<never, never>

export type StatusKey<Id extends string = string, Name extends string = string> = `${Id}:${Name}`

/** The value of a status, by its kind. */
export const StatusValue = Schema.Union([
  Schema.TaggedStruct("count", { count: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)) }),
  /** When the newest thing came: newer than the person's last visit, it shows. */
  Schema.TaggedStruct("new", { at: Schema.DateTimeUtc }),
  Schema.TaggedStruct("running", {
    /** From 0 to 1, when the app knows. */
    progress: Schema.NullOr(Schema.Number.check(Schema.isBetween({ minimum: 0, maximum: 1 }))),
    /** What is running, e.g. "Importing 1,200 orders". */
    label: Schema.NullOr(Schema.String.check(Schema.isMaxLength(120))),
  }),
  Schema.TaggedStruct("health", {
    level: Schema.Literals(["warning", "danger"]),
    /** What is wrong, e.g. "Payments are delayed: the bank does not answer". */
    label: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(200)),
  }),
])
export type StatusValue = typeof StatusValue.Type

/** One sentence for a status, e.g. "Orders waiting for approval: 3" or "Importing orders (40%)". */
export const statusSentence = (status: { readonly description: string; readonly value: StatusValue }): string => {
  const { description, value } = status
  switch (value._tag) {
    case "count":
      return `${description}: ${value.count}`
    case "new":
      return `New: ${description}`
    case "running": {
      const label = value.label ?? description
      return value.progress === null ? label : `${label} (${Math.round(value.progress * 100)}%)`
    }
    case "health":
      return value.label
  }
}

/** Who a status value is for: one person, or everyone with a permission of the app. */
export const StatusAudience = Schema.Union([
  Schema.TaggedStruct("user", { id: UserId }),
  Schema.TaggedStruct("permission", { permission: PermissionKey }),
])
export type StatusAudience = typeof StatusAudience.Type

export const StatusAudiences = {
  user: (id: UserId): StatusAudience => ({ _tag: "user", id }),
  permission: (permission: PermissionKey): StatusAudience => ({ _tag: "permission", permission }),
}
