import { createServer, type ServerResponse } from "node:http"
import type { AddressInfo } from "node:net"
import { describe, expect, it } from "@effect/vitest"
import { APP_KEY_HEADER, STORAGE_CONTENT_PATH } from "@mosaik/platform/contract"
import { PlatformClient } from "@mosaik/platform/server"
import { ConfigProvider, Effect, Layer } from "effect"
import { HttpServerResponse } from "effect/http"
import { Storage } from "./Storage"

/**
 * The platform's content routes, as Core answers them: files kept in memory, a limit of 100 bytes,
 * and the key checked (Node's server: the tests run in Node).
 */
const fakePlatform = () =>
  Effect.promise(async () => {
    const files = new Map<string, { body: Buffer; type: string }>()
    const json = (response: ServerResponse, status: number, body: unknown) => {
      response.writeHead(status, { "content-type": "application/json" }).end(JSON.stringify(body))
    }
    const server = createServer(async (request, response) => {
      const url = new URL(request.url ?? "/", "http://platform")
      if (url.pathname !== STORAGE_CONTENT_PATH) return json(response, 404, {})
      if (request.headers[APP_KEY_HEADER] !== "mk_test")
        return json(response, 401, { _tag: "Unauthorized", message: "Invalid app key" })
      const key = url.searchParams.get("key") ?? ""
      if (request.method === "PUT") {
        const chunks: Array<Buffer> = []
        for await (const chunk of request) chunks.push(chunk as Buffer)
        const body = Buffer.concat(chunks)
        if (body.byteLength > 100)
          return json(response, 507, { _tag: "StorageLimitReached", limitBytes: 100, usedBytes: 0 })
        const type = request.headers["content-type"] ?? ""
        files.set(key, { body, type })
        return json(response, 200, {
          key,
          size: body.byteLength,
          contentType: type,
          updatedAt: "2026-10-20T10:00:00.000Z",
        })
      }
      const file = files.get(key)
      if (file === undefined) return json(response, 404, { _tag: "NotFound", resource: "file", id: key })
      response
        .writeHead(200, {
          "content-type": file.type,
          "content-length": String(file.body.byteLength),
          "last-modified": "Tue, 20 Oct 2026 10:00:00 GMT",
        })
        .end(file.body)
    })
    await new Promise<void>((listening) => server.listen(0, listening))
    const { port } = server.address() as AddressInfo
    const layer = Storage.layer("sales").pipe(
      Layer.provide(Layer.succeed(PlatformClient, {} as PlatformClient["Service"])),
      Layer.provide(
        ConfigProvider.layer(
          ConfigProvider.fromUnknown({ PLATFORM_URL: `http://localhost:${port}`, MOSAIK_APP_KEY: "mk_test" }),
        ),
      ),
    )
    return { layer, stop: () => new Promise<void>((closed) => server.close(() => closed())) }
  })

const withPlatform = <A, E>(use: Effect.Effect<A, E, Storage>) =>
  Effect.acquireUseRelease(
    fakePlatform(),
    (platform) => use.pipe(Effect.provide(platform.layer)),
    (platform) => Effect.promise(() => platform.stop()),
  )

const text = (response: HttpServerResponse.HttpServerResponse) =>
  Effect.promise(() => HttpServerResponse.toWeb(response).text())

describe("Storage", () => {
  it.live("stores what it is given and reads it back as a stream", () =>
    withPlatform(
      Effect.gen(function* () {
        const storage = yield* Storage
        const stored = yield* storage.put("notes/a.txt", "hello", { contentType: "text/plain" })
        expect(stored).toMatchObject({ key: "notes/a.txt", size: 5, contentType: "text/plain" })
        const file = yield* storage.get("notes/a.txt")
        expect(file.object).toMatchObject({ size: 5, contentType: "text/plain" })
        expect(yield* Effect.promise(() => new Response(file.body).text())).toBe("hello")
        // A file's own type when none is given.
        const blob = yield* storage.put("notes/b.json", new Blob(["{}"], { type: "application/json" }))
        expect(blob.contentType).toBe("application/json")
      }),
    ),
  )

  it.live("fails with the platform's errors, typed", () =>
    withPlatform(
      Effect.gen(function* () {
        const storage = yield* Storage
        const over = yield* Effect.flip(storage.put("big.bin", new Uint8Array(200)))
        expect(over).toMatchObject({ _tag: "StorageLimitReached", limitBytes: 100 })
        const missing = yield* Effect.flip(storage.get("nothing.txt"))
        expect(missing).toMatchObject({ _tag: "NotFound", id: "nothing.txt" })
      }),
    ),
  )

  it.live("sends files as downloads that cannot run as the app, images and PDFs inline on request", () =>
    withPlatform(
      Effect.gen(function* () {
        const storage = yield* Storage
        yield* storage.put("pages/x.html", "<script>alert(1)</script>", { contentType: "text/html" })
        const html = yield* storage.respond("pages/x.html", { inline: true })
        expect(html.headers["content-disposition"]).toBe("attachment; filename=\"x.html\"; filename*=UTF-8''x.html")
        expect(html.headers["x-content-type-options"]).toBe("nosniff")
        expect(html.headers["content-security-policy"]).toBe("sandbox")
        expect(yield* text(html)).toBe("<script>alert(1)</script>")

        yield* storage.put("scans/faktura ż.png", new Uint8Array([1, 2, 3]), { contentType: "image/png" })
        const image = yield* storage.respond("scans/faktura ż.png", { inline: true })
        expect(image.headers["content-disposition"]).toBe(
          `inline; filename="faktura _.png"; filename*=UTF-8''faktura%20%C5%BC.png`,
        )
      }),
    ),
  )
})
