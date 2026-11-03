import { Database, runApp } from "@mosaik/sdk/server"
import { Layer } from "effect"
import { SalesApi } from "../api"
import { sales } from "../manifest"
import { Handlers } from "./http"
import { migrations } from "./migrations"
import { Orders } from "./Orders"
import { PendingOrdersStatus } from "./pending"

runApp({
  app: sales,
  api: SalesApi,
  handlers: Layer.mergeAll(Handlers, PendingOrdersStatus.pipe(Layer.provide(Orders.layer))).pipe(
    Layer.provide(Database.layer({ serviceId: sales.id, migrations })),
  ),
})
