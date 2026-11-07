import { Database, runApp } from "@mosaik/sdk/server"
import { Layer } from "effect"
import { LinksApi } from "../api"
import { links } from "../manifest"
import { ApiHandlers } from "./http"
import { Links } from "./Links"
import { migrations } from "./migrations"

runApp({
  app: links,
  api: LinksApi,
  handlers: ApiHandlers.pipe(
    Layer.provide(Links.layer),
    Layer.provide(Database.layer({ serviceId: links.id, migrations })),
  ),
})
