import { createServer, type Server } from "node:http"
import type { AddressInfo } from "node:net"
import { describe, expect, it } from "@effect/vitest"
import { Principal, PrincipalUser, UserId } from "@mosaik/core"
import { AppTool, AppTools, ROUTES_STREAM_PATH, TOOLS_PATH } from "@mosaik/platform/contract"
import { ConfigProvider, Effect, Layer, Schema } from "effect"
import { Catalog } from "./Catalog"

const admin = new Principal({
  user: new PrincipalUser({ id: UserId.make("u1"), email: "ada@example.com", name: "Ada", image: null }),
  grants: ["*"],
})

const tools = Schema.encodeSync(Schema.toCodecJson(AppTools))(
  new AppTools({
    app: "shop",
    tools: [
      new AppTool({
        name: "orders.search",
        title: "Find orders",
        description: "Finds orders",
        examples: [],
        method: "GET",
        path: "/api/shop/orders",
        permission: "shop:view",
        readOnly: true,
        destructive: false,
        params: null,
        query: null,
        payload: null,
      }),
    ],
  }),
)

const listen = (server: Server) =>
  new Promise<number>((listening) => server.listen(0, () => listening((server.address() as AddressInfo).port)))

/**
 * The platform's stream of app routes (one app, `shop`) and that app, which serves its tools only
 * after `appReadyAfter` milliseconds, like an app still starting (Node's servers: the tests run in Node).
 */
const fakePlatform = (appReadyAfter: number) =>
  Effect.promise(async () => {
    const startedAt = Date.now()
    const app = createServer((request, response) => {
      if (request.url !== TOOLS_PATH) return response.writeHead(404).end()
      if (Date.now() - startedAt < appReadyAfter) return response.writeHead(503).end()
      response.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(tools))
    })
    const appPort = await listen(app)
    const platform = createServer((request, response) => {
      if (request.url !== ROUTES_STREAM_PATH) return response.writeHead(404).end()
      response.writeHead(200, { "content-type": "text/event-stream" })
      response.write(`data: ${JSON.stringify([{ id: "shop", upstream: `http://localhost:${appPort}` }])}\n\n`)
    })
    const platformPort = await listen(platform)
    const layer = Catalog.layer.pipe(
      Layer.provide(
        ConfigProvider.layer(
          ConfigProvider.fromUnknown({ PLATFORM_URL: `http://localhost:${platformPort}`, INTERNAL_KEY: "key" }),
        ),
      ),
    )
    const stop = () => {
      platform.closeAllConnections()
      return Promise.all([app, platform].map((server) => new Promise<void>((closed) => server.close(() => closed()))))
    }
    return { layer, stop }
  })

const withPlatform = <A, E>(appReadyAfter: number, use: Effect.Effect<A, E, Catalog>) =>
  Effect.acquireUseRelease(
    fakePlatform(appReadyAfter),
    (platform) => use.pipe(Effect.provide(platform.layer)),
    (platform) => Effect.promise(() => platform.stop()),
  )

const names = Effect.gen(function* () {
  const catalog = yield* Catalog
  return (yield* catalog.visibleTo(admin)).map((tool) => tool.name)
})

describe("Catalog", () => {
  it.live("lets the first request wait for apps' tools rather than find none", () =>
    withPlatform(
      0,
      Effect.map(names, (found) => expect(found).toEqual(["shop_orders_search"])),
    ),
  )

  it.live(
    "reads an app that could not be reached when it was listed again within seconds",
    () =>
      withPlatform(
        1_000,
        Effect.gen(function* () {
          // Listed while it still starts: no tools yet.
          expect(yield* names).toEqual([])
          // The retry, not the half-minute refresh, finds them.
          yield* Effect.sleep("6500 millis")
          expect(yield* names).toEqual(["shop_orders_search"])
        }),
      ),
    15_000,
  )
})
