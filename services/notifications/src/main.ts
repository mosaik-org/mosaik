import { AccessControlUsers, InternalAuthLive, InternalClient, TokenVerifier } from "@mosaik/auth/server"
import { Database } from "@mosaik/db"
import { NOTIFICATIONS_API_PREFIX, NotificationsApi, NotificationsInternalApi } from "@mosaik/notifications/contract"
import { CorePages, runMain, serve } from "@mosaik/server"
import { Layer } from "effect"
import { FetchHttpClient } from "effect/http"
import { HttpApiBuilder } from "effect/http-api"
import { Channels } from "./delivery/Channels"
import { Outbox } from "./delivery/Outbox"
import * as Worker from "./delivery/Worker"
import { AdminHandlers } from "./http/Admin"
import { InboxHandlers } from "./http/Inbox"
import { MessagesHandlers, NotificationsHandlers } from "./http/Internal"
import { LinkPage, PreferencesPage } from "./http/Pages"
import { SettingsHandlers } from "./http/Settings"
import { Fanout } from "./inbox/Fanout"
import * as Housekeeping from "./inbox/Housekeeping"
import { Inbox } from "./inbox/Inbox"
import { Directory } from "./messages/Directory"
import { Dispatcher } from "./messages/Dispatcher"
import { migrations } from "./migrations"
import { NotificationsConfig } from "./NotificationsConfig"
import { Notifier } from "./notify/Notifier"
import { Preferences } from "./notify/Preferences"
import { NotificationTypes } from "./notify/Types"
import { Routes } from "./targets/Routes"
import { Targets } from "./targets/Targets"

const Repositories = Layer.mergeAll(Targets.layer, Routes.layer, NotificationTypes.layer, Preferences.layer).pipe(
  // The outbox files notifications in inboxes, in the transaction that queues them.
  Layer.provideMerge(Outbox.layer.pipe(Layer.provideMerge(Inbox.layer))),
  Layer.provideMerge(Database.layer({ serviceId: "notifications", migrations })),
)

const Infrastructure = Layer.mergeAll(Channels.layer, Fanout.layer, Directory.layer).pipe(
  Layer.provideMerge(Repositories),
)

const Domain = Layer.mergeAll(Dispatcher.layer, Notifier.layer, Worker.layer, Housekeeping.layer).pipe(
  Layer.provideMerge(Infrastructure),
  Layer.provideMerge(InternalClient.layer),
  Layer.provideMerge(FetchHttpClient.layer),
  Layer.provideMerge(NotificationsConfig.layer),
)

/** Service-to-service API (`/internal`), never routed by the gateway. */
const InternalHttp = HttpApiBuilder.layer(NotificationsInternalApi).pipe(
  Layer.provide([MessagesHandlers, NotificationsHandlers]),
)

/** Browser API (`/api/notifications`), through the gateway. */
const PublicHttp = HttpApiBuilder.layer(NotificationsApi, {
  openapiPath: `${NOTIFICATIONS_API_PREFIX}/openapi.json`,
}).pipe(Layer.provide([InboxHandlers, SettingsHandlers, AdminHandlers]))

const Middleware = Layer.mergeAll(InternalAuthLive, AccessControlUsers, CorePages.layer).pipe(
  Layer.provide(TokenVerifier.layerRemote("notifications")),
)

const Main = serve(Layer.mergeAll(InternalHttp, PublicHttp, PreferencesPage, LinkPage), {
  name: "mosaik-notifications",
  port: 4001,
}).pipe(Layer.provide(Middleware), Layer.provide(Domain))

runMain(Main)
