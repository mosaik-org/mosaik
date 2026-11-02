import { ASSISTANT_API_PREFIX, AssistantApi } from "@mosaik/assistant/contract"
import { AccessControlUsers, InternalClient, TokenVerifier } from "@mosaik/auth/server"
import { Database } from "@mosaik/db"
import { runMain, serve } from "@mosaik/server"
import { AppCalls, Catalog } from "@mosaik/tools"
import { Layer } from "effect"
import { HttpApiBuilder } from "effect/http-api"
import { AssistantConfig } from "./AssistantConfig"
import { Conversations } from "./Conversations"
import { AssistantHandlers } from "./http/Assistant"
import { Model } from "./Model"
import { migrations } from "./migrations"
import { Turns } from "./Turns"

/**
 * The assistant: a chat in Mosaik's UI with an AI that uses apps' tools as the person, asking
 * them to approve every change. Reached through the gateway at `/api/assistant`.
 */
const Domain = Turns.layer.pipe(
  Layer.provideMerge(Layer.mergeAll(Model.layer, Conversations.layer, Catalog.layer, AppCalls.layer)),
  Layer.provideMerge(Database.layer({ serviceId: "assistant", migrations })),
  Layer.provideMerge(Layer.mergeAll(AssistantConfig.layer, InternalClient.layer)),
)

const Http = HttpApiBuilder.layer(AssistantApi, { openapiPath: `${ASSISTANT_API_PREFIX}/openapi.json` }).pipe(
  Layer.provide(AssistantHandlers),
)

const Middleware = AccessControlUsers.pipe(Layer.provide(TokenVerifier.layerRemote("assistant")))

const Main = serve(Http, { name: "mosaik-assistant", port: 4005 }).pipe(
  Layer.provide(Middleware),
  Layer.provide(Domain),
)

runMain(Main)
