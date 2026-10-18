import { Schema } from "effect"
import { PrincipalUser, UserId } from "./principal"

/**
 * Events the platform publishes to apps. An app subscribes in its manifest (`events`)
 * and handles them with `Events` from `@mosaik/server`.
 */
export const PlatformEventType = Schema.Literals(["user.created", "user.deleted", "user.access_changed"])
export type PlatformEventType = typeof PlatformEventType.Type

/** What an app receives with each event. */
export const PlatformEventData = {
  "user.created": Schema.Struct({ user: PrincipalUser }),
  "user.deleted": Schema.Struct({ userId: UserId }),
  /**
   * The user's roles changed, or the grants of one of their roles. `grants` are the user's
   * grants in this app (like a token's), `hasAccess` whether they cover the app's access permission.
   */
  "user.access_changed": Schema.Struct({
    userId: UserId,
    hasAccess: Schema.Boolean,
    grants: Schema.Array(Schema.String),
  }),
} satisfies Record<PlatformEventType, Schema.Top>

export type PlatformEventData<T extends PlatformEventType> = (typeof PlatformEventData)[T]["Type"]

/** Shown to admins installing an app that subscribes. */
export const PLATFORM_EVENT_DESCRIPTIONS: Record<PlatformEventType, string> = {
  "user.created": "A user was created (name and e-mail)",
  "user.deleted": "A user was deleted",
  "user.access_changed": "A user's access to the app changed",
}
