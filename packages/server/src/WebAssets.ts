import { join, normalize, resolve, sep } from "node:path"
import type { AnyApp } from "@mosaik/core"
import { type WebBundle, WebBundle as WebBundleSchema } from "@mosaik/platform/contract"
import { Config, Effect, Option, Schema } from "effect"
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/http"

/** Must match `WEB_BUNDLE_FILE` in `@mosaik/app-kit/bundle`. */
const BUNDLE_FILE = "mosaik-web.json"

const decodeBundle = Schema.decodeUnknownEffect(Schema.fromJsonString(WebBundleSchema))

/**
 * The app's browser bundle (`MOSAIK_WEB_DIR`, default `dist/web`, built by `mosaikApp()` from
 * `@mosaik/sdk/build/vite`), if there is one. Built-in apps have none: they are compiled into the shell.
 */
export const loadWebBundle = Effect.gen(function* () {
  const dir = resolve(yield* Config.String("MOSAIK_WEB_DIR").pipe(Config.withDefault("dist/web")))
  const file = Bun.file(join(dir, BUNDLE_FILE))
  if (!(yield* Effect.promise(() => file.exists()))) return Option.none<{ dir: string; bundle: WebBundle }>()
  const bundle = yield* decodeBundle(yield* Effect.promise(() => file.text())).pipe(Effect.orDie)
  yield* Effect.logInfo("Serving the web bundle", { entry: bundle.entry })
  return Option.some({ dir, bundle })
})

/** Serves the bundle at `/apps/<id>/*`; file names are content-hashed, so they are cached for good. */
export const webAssetsRoute = (app: AnyApp, dir: string) =>
  HttpRouter.add(
    "GET",
    `/apps/${app.id}/*`,
    Effect.gen(function* () {
      const request = yield* HttpServerRequest.HttpServerRequest
      const path = decodeURIComponent(new URL(request.url, "http://app").pathname).slice(`/apps/${app.id}/`.length)
      const target = normalize(join(dir, path))
      if (!target.startsWith(dir + sep) || path.endsWith(BUNDLE_FILE)) return HttpServerResponse.empty({ status: 404 })
      const file = Bun.file(target)
      if (!(yield* Effect.promise(() => file.exists()))) return HttpServerResponse.empty({ status: 404 })
      return HttpServerResponse.fromWeb(
        new Response(file, {
          headers: { "content-type": file.type, "cache-control": "public, max-age=31536000, immutable" },
        }),
      )
    }),
  )
