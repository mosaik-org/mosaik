import { AccessControlUsers, InternalClient, TokenVerifier } from "@mosaik/auth/server"
import { Database } from "@mosaik/db"
import { PORTAL_WEB_PREFIX, PortalWebApi } from "@mosaik/portal/contract"
import { runMain, serve } from "@mosaik/server"
import { Layer } from "effect"
import { FetchHttpClient } from "effect/http"
import { HttpApiBuilder } from "effect/http-api"
import { Bootstrap } from "./Bootstrap"
import { CoreClient } from "./clients"
import { Deployer } from "./Deployer"
import { Docker } from "./docker/Docker"
import { Health } from "./Health"
import { AdminHandlers, CatalogHandlers, DirectoryHandlers, WorkspaceHandlers } from "./http/Web"
import { Installations } from "./Installations"
import { Installer } from "./Installer"
import { migrations } from "./migrations"
import { PortalConfig } from "./PortalConfig"
import { Secrets } from "./Secrets"
import { UserEvents } from "./UserEvents"
import { Workspace } from "./Workspace"

/** Core, used through its APIs only: the auth service and the platform service. */
const Core = Layer.mergeAll(InternalClient.layer, CoreClient.layer, FetchHttpClient.layer)

const Domain = Layer.mergeAll(Installer.layer, UserEvents, Bootstrap).pipe(
  Layer.provideMerge(Layer.mergeAll(Deployer.layer.pipe(Layer.provide(Docker.layer)), Health.layer)),
  Layer.provideMerge(Layer.mergeAll(Installations.layer, Workspace.layer, Secrets.layer)),
  Layer.provideMerge(Database.layer({ serviceId: "portal", migrations })),
  Layer.provideMerge(PortalConfig.layer),
  Layer.provideMerge(Core),
)

/** The shell's app catalog, users' apps, app pages and installing apps (`/api/portal`), through the gateway. */
const WebHttp = HttpApiBuilder.layer(PortalWebApi, { openapiPath: `${PORTAL_WEB_PREFIX}/openapi.json` }).pipe(
  Layer.provide([CatalogHandlers, WorkspaceHandlers, DirectoryHandlers, AdminHandlers]),
)

const Middleware = AccessControlUsers.pipe(Layer.provide(TokenVerifier.layerRemote("portal")))

const Main = serve(WebHttp, { name: "mosaik-portal", port: 4003 }).pipe(
  Layer.provide(Middleware),
  Layer.provide(Domain),
)

runMain(Main)
