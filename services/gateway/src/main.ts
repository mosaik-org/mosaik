import { InternalClient } from "@mosaik/auth/server"
import { runMain, serve } from "@mosaik/server"
import { Config, Effect, Layer, Option } from "effect"
import { HttpStaticServer } from "effect/http"
import * as ApiProxy from "./Proxy"

/** In production the gateway also serves the built SPA (`STATIC_DIR`), falling back to `index.html`. */
const StaticFiles = Layer.unwrap(
  Effect.gen(function* () {
    const root = yield* Config.option(Config.String("STATIC_DIR"))
    return Option.match(root, {
      onNone: () => Layer.empty,
      onSome: (root) => HttpStaticServer.layer({ root, spa: true, cacheControl: "public, max-age=300" }),
    })
  }),
)

const Main = serve(Layer.mergeAll(ApiProxy.layer, StaticFiles), { name: "mosaik-gateway", port: 3000 }).pipe(
  Layer.provide(InternalClient.layer),
)

runMain(Main)
