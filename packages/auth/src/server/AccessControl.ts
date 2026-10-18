import {
  AccessControl,
  type AnyApp,
  CurrentPrincipal,
  Forbidden,
  type PermissionKey,
  RequiredPermission,
  Unauthorized,
} from "@mosaik/core"
import { Context, Effect, Layer, Option, Redacted } from "effect"
import type { HttpApiEndpoint, HttpApiGroup } from "effect/http-api"
import { TokenVerifier } from "./TokenVerifier"

const annotatedPermission = (endpoint: HttpApiEndpoint.Top, group: HttpApiGroup.Top): Option.Option<PermissionKey> =>
  Context.getOption(endpoint.annotations, RequiredPermission).pipe(
    Option.orElse(() => Context.getOption(group.annotations, RequiredPermission)),
  )

/**
 * Verifies the gateway token and checks the permission required by `requirement`
 * (`undefined`: any logged-in user).
 */
const makeAccessControl = (
  requirement: (endpoint: HttpApiEndpoint.Top, group: HttpApiGroup.Top) => PermissionKey | undefined,
) =>
  Layer.effect(
    AccessControl,
    Effect.gen(function* () {
      const verifier = yield* TokenVerifier
      return AccessControl.of({
        bearer: Effect.fn("AccessControl")(function* (httpEffect, { credential, endpoint, group }) {
          const principal = yield* verifier.verify(Redacted.value(credential))
          const permission = requirement(endpoint, group)
          if (permission === undefined ? !principal.isAuthenticated : !principal.can(permission)) {
            return yield* principal.isAuthenticated && permission !== undefined
              ? new Forbidden({ permission })
              : new Unauthorized({ message: "Login required" })
          }
          yield* Effect.annotateCurrentSpan({
            "mosaik.user": principal.user?.id ?? "anonymous",
            "mosaik.permission": permission ?? "authenticated",
          })
          return yield* Effect.provideService(httpEffect, CurrentPrincipal, principal)
        }),
      })
    }),
  )

/**
 * Server implementation of {@link AccessControl} for an app:
 * verifies the gateway token, then checks the endpoint's required permission
 * (falling back to the app's `access` permission).
 */
export const AccessControlLive = (app: AnyApp) =>
  makeAccessControl((endpoint, group) =>
    Option.getOrElse(annotatedPermission(endpoint, group), () => app.accessPermission),
  )

/**
 * {@link AccessControl} for platform services used by every user (e.g. notifications):
 * endpoints need a logged-in user, plus their `RequiredPermission` when annotated.
 */
export const AccessControlUsers = makeAccessControl((endpoint, group) =>
  Option.getOrUndefined(annotatedPermission(endpoint, group)),
)
