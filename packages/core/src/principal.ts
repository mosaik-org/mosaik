import { Effect, Schema } from "effect"
import { Grant, isGranted } from "./permission"

export const UserId = Schema.String.pipe(Schema.brand("@mosaik/UserId"))
export type UserId = typeof UserId.Type

export class PrincipalUser extends Schema.Class<PrincipalUser>("@mosaik/core/PrincipalUser")({
  id: UserId,
  email: Schema.String,
  name: Schema.String,
  image: Schema.NullOr(Schema.String),
}) {}

/**
 * Who is making a request and what they are allowed to do.
 * Visitors that are not logged in are principals too (`user: null`), carrying the
 * grants of the built-in `anonymous` role.
 */
export class Principal extends Schema.Class<Principal>("@mosaik/core/Principal")({
  user: Schema.NullOr(PrincipalUser),
  grants: Schema.Array(Grant),
  /**
   * The AI client acting for the user, by name (e.g. "Claude"), when the request comes from one
   * through Mosaik's MCP server; `null` otherwise. The audit log records it with what it does.
   */
  agent: Schema.NullOr(Schema.String).pipe(Schema.withConstructorDefault(Effect.succeed(null))),
}) {
  get isAuthenticated(): boolean {
    return this.user !== null
  }

  can(permission: string): boolean {
    return isGranted(this.grants, permission)
  }
}
