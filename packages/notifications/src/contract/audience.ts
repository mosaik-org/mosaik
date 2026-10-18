import { PermissionKey, UserId } from "@mosaik/core"
import { Schema } from "effect"

/** Who receives a notification. Each user then gets it on the channels they chose. */
export const Audience = Schema.TaggedUnion({
  Users: { userIds: Schema.Array(UserId).check(Schema.isMaxLength(1000)) },
  /** Everyone holding the permission (through any role, wildcards included). */
  Permission: { permission: PermissionKey },
  Everyone: {},
})
export type Audience = typeof Audience.Type

/**
 * Audience constructors.
 *
 * @example
 * notify.send({ type: sales.notification("order.refunded"), audience: Audiences.permission(sales.perm("orders.refund")), content })
 */
export const Audiences = {
  users: (...userIds: ReadonlyArray<UserId>): Audience => ({ _tag: "Users", userIds }),
  permission: (permission: PermissionKey): Audience => ({ _tag: "Permission", permission }),
  everyone: { _tag: "Everyone" } as Audience,
}
