import { AdminApi, admin, IdentityApi, InternalApi } from "@mosaik/auth/contract"
import { AccessControlLive, InternalAuthLive } from "@mosaik/auth/server"
import { Database } from "@mosaik/db"
import { CorePages, runMain, serve } from "@mosaik/server"
import { Layer } from "effect"
import { HttpApiBuilder } from "effect/http-api"
import { AccessFeed } from "./AccessFeed"
import { AuthConfig } from "./AuthConfig"
import { BetterAuth } from "./BetterAuth"
import { Bootstrap } from "./Bootstrap"
import { EventRelay } from "./EventRelay"
import { AdminHandlers } from "./http/Admin"
import { IdentityHandlers } from "./http/Identity"
import { InternalHandlers } from "./http/Internal"
import { OAuthRoutes } from "./http/OAuth"
import { RawRoutes } from "./http/Routes"
import { SignInRoutes } from "./http/SignIn"
import { migrations } from "./migrations"
import { OAuth } from "./OAuth"
import { PlatformClient } from "./PlatformClient"
import { Access } from "./rbac/Access"
import { AuditLog } from "./rbac/AuditLog"
import { Members } from "./rbac/Members"
import { Registry } from "./rbac/Registry"
import { Roles } from "./rbac/Roles"
import { Users } from "./rbac/Users"
import { SigningKeys } from "./SigningKeys"

// Better Auth migrates its tables first; ours reference `"user"`.
const Persistence = Database.layer({ serviceId: "auth", migrations }).pipe(
  Layer.provideMerge(BetterAuth.layer),
  Layer.provide(AuthConfig.layer),
)

const Domain = Layer.mergeAll(Members.layer, OAuth.layer).pipe(
  Layer.provideMerge(
    Layer.mergeAll(
      Access.layer,
      Roles.layer,
      Users.layer,
      Registry.layer,
      AuditLog.layer,
      SigningKeys.layer,
      AccessFeed.layer,
    ),
  ),
  Layer.provideMerge(Persistence),
  Layer.provideMerge(PlatformClient.layer),
)

const Http = Layer.mergeAll(
  RawRoutes,
  SignInRoutes,
  OAuthRoutes,
  HttpApiBuilder.layer(IdentityApi).pipe(Layer.provide(IdentityHandlers)),
  HttpApiBuilder.layer(InternalApi).pipe(Layer.provide(InternalHandlers)),
  HttpApiBuilder.layer(AdminApi, { openapiPath: `${admin.apiPrefix}/openapi.json` }).pipe(Layer.provide(AdminHandlers)),
)

const Middleware = Layer.mergeAll(InternalAuthLive, AccessControlLive(admin)).pipe(
  Layer.provide(SigningKeys.verifierLayer(admin.id)),
)

/** Core's sign-in page (the gateway routes `/api/auth` here as the `auth` service). */
const Pages = CorePages.layer.pipe(Layer.provide(SigningKeys.verifierLayer("auth")))

const Main = serve(Layer.mergeAll(Http, Bootstrap, EventRelay), { name: "mosaik-auth", port: 4000 }).pipe(
  Layer.provide([Middleware, Pages]),
  Layer.provide(Domain),
  Layer.provide(AuthConfig.layer),
)

runMain(Main)
