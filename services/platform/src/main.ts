import { AccessControlUsers, InternalAuthLive, InternalClient, TokenVerifier } from "@mosaik/auth/server"
import { Database } from "@mosaik/db"
import { PLATFORM_WEB_PREFIX, PlatformApi, PlatformInternalApi, PlatformWebApi } from "@mosaik/platform/contract"
import { runMain, serve } from "@mosaik/server"
import { Layer } from "effect"
import { FetchHttpClient } from "effect/http"
import { HttpApiBuilder } from "effect/http-api"
import { AccessRequests } from "./AccessRequests"
import { AppAuthLive } from "./AppAuthLive"
import { Apps } from "./Apps"
import { NotificationsClient } from "./clients"
import { Events } from "./Events"
import { AppHandlers, KeysHandlers } from "./http/App"
import { ClientsHandlers, EventsHandlers, RegistryHandlers, RoutesHandlers } from "./http/Internal"
import { AccessHandlers, AccessReviewHandlers, AppsHandlers } from "./http/Web"
import { migrations } from "./migrations"
import { Ownership } from "./Ownership"
import { PlatformConfig } from "./PlatformConfig"
import { Provisioner } from "./Provisioner"
import { Registry } from "./Registry"
import { RouteFeed } from "./RouteFeed"

const Clients = Layer.mergeAll(InternalClient.layer, NotificationsClient.layer, FetchHttpClient.layer)

const Domain = Layer.mergeAll(Registry.layer, RouteFeed.layer, Ownership.layer).pipe(
  Layer.provideMerge(Layer.mergeAll(Apps.layer, Events.layer, AccessRequests.layer, Provisioner.layer)),
  Layer.provideMerge(Database.layer({ serviceId: "platform", migrations })),
  Layer.provideMerge(PlatformConfig.layer),
  Layer.provideMerge(Clients),
)

/** The API apps call (`/api/platform/v1`): directly from built-in apps, through the gateway from the others. */
const AppHttp = HttpApiBuilder.layer(PlatformApi).pipe(Layer.provide([AppHandlers, KeysHandlers]))

/** Who can use apps and requests for access (`/api/platform`), through the gateway. */
const WebHttp = HttpApiBuilder.layer(PlatformWebApi, { openapiPath: `${PLATFORM_WEB_PREFIX}/openapi.json` }).pipe(
  Layer.provide([AccessHandlers, AccessReviewHandlers, AppsHandlers]),
)

/** Platform services only (`/internal`: routes, events, the app registry, sign-in clients), never routed by the gateway. */
const InternalHttp = HttpApiBuilder.layer(PlatformInternalApi).pipe(
  Layer.provide([RoutesHandlers, EventsHandlers, RegistryHandlers, ClientsHandlers]),
)

const Middleware = Layer.mergeAll(
  AppAuthLive,
  InternalAuthLive,
  AccessControlUsers.pipe(Layer.provide(TokenVerifier.layerRemote("platform"))),
)

const Main = serve(Layer.mergeAll(AppHttp, WebHttp, InternalHttp), { name: "mosaik-platform", port: 4002 }).pipe(
  Layer.provide(Middleware),
  Layer.provide(Domain),
)

runMain(Main)
