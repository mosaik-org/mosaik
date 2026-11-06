import { Database, runApp } from "@mosaik/sdk/server"
import { Layer } from "effect"
import { DeskApi } from "../api"
import { desk } from "../manifest"
import { Changes } from "./Changes"
import { Desk } from "./Desk"
import { DemoFreshness } from "./demo"
import { EventHandlers } from "./events"
import { ApiHandlers } from "./http"
import { migrations } from "./migrations"
import { PeoplePostgres } from "./People"
import { Requests } from "./Requests"
import { Setup } from "./Setup"
import { Statuses } from "./Statuses"
import { Sweep } from "./sweep"

const Stores = Layer.mergeAll(Requests.layer, PeoplePostgres, Setup.layer, Changes.layer).pipe(
  Layer.provideMerge(Database.layer({ serviceId: desk.id, migrations })),
)
const Services = Statuses.layer.pipe(Layer.provideMerge(Stores))

runApp({
  app: desk,
  api: DeskApi,
  handlers: Layer.mergeAll(
    ApiHandlers.pipe(Layer.provide(Desk.layer)),
    Sweep.running.pipe(Layer.provide(Sweep.layer)),
    DemoFreshness,
  ).pipe(Layer.provide(Services)),
  events: EventHandlers.pipe(Layer.provide(Services)),
})
