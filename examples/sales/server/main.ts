import { Database, runApp } from "@mosaik/sdk/server"
import { Layer } from "effect"
import { SalesApi } from "../api"
import { sales } from "../manifest"
import { Handlers } from "./http"
import { migrations } from "./migrations"

runApp({
  app: sales,
  api: SalesApi,
  handlers: Handlers.pipe(Layer.provide(Database.layer({ serviceId: sales.id, migrations }))),
})
