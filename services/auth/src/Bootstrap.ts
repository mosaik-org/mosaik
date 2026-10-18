import { admin } from "@mosaik/auth/contract"
import { toManifestPayload } from "@mosaik/core"
import { Effect, Layer, Option } from "effect"
import { AuthConfig } from "./AuthConfig"
import { Registry } from "./rbac/Registry"
import { Users } from "./rbac/Users"

/**
 * Startup tasks: register the admin app (served by this service) and make
 * sure the bootstrap superadmin from `ADMIN_EMAIL` / `ADMIN_PASSWORD` exists.
 */
export const Bootstrap = Layer.effectDiscard(
  Effect.gen(function* () {
    const config = yield* AuthConfig
    const registry = yield* Registry
    const users = yield* Users

    yield* registry.register(toManifestPayload(admin)).pipe(Effect.orDie)

    if (Option.isSome(config.bootstrapAdmin)) {
      const { email, password } = config.bootstrapAdmin.value
      yield* users.ensureSuperadmin(email, password)
    }
  }).pipe(Effect.withSpan("Bootstrap")),
)
