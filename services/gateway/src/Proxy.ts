import { Effect, Layer } from "effect"
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/http"
import { Tokens } from "./Tokens"
import { Upstreams } from "./Upstreams"

/** Hop-by-hop headers are connection-specific and must not be forwarded. */
const HOP_BY_HOP = [
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "host",
]

/** Services that authenticate with the session cookie themselves (Better Auth). */
const COOKIE_SERVICES = new Set(["auth"])

const notFound = (service: string) =>
  HttpServerResponse.jsonUnsafe({ _tag: "NotFound", resource: "service", id: service }, { status: 404 })

/**
 * `/api/<service>/*` → upstream service. Cookies never leave the gateway (except to
 * the auth service); every other upstream receives a short-lived signed token, issued
 * for that service only. `/apps/<id>/*` → the app's browser bundle.
 */
export const ProxyRoute = HttpRouter.use(
  Effect.fn(function* (router) {
    const upstreams = yield* Upstreams
    const tokens = yield* Tokens

    /**
     * Forwards a request to the service named by the second path segment.
     * `api`: with a token for that service. `assets`: an app's static browser bundle, without credentials.
     */
    const forward = (kind: "api" | "assets") =>
      Effect.fn("Gateway.proxy")(function* (request: HttpServerRequest.HttpServerRequest) {
        const incoming = yield* HttpServerRequest.toWeb(request).pipe(Effect.orDie)
        const url = new URL(incoming.url)
        const service = url.pathname.split("/")[2] ?? ""
        const route = yield* upstreams.resolve(service)
        // Only apps (not platform services) have browser bundles.
        if (route === undefined || (kind === "assets" && route.scope === null)) return notFound(service)
        const upstream = route.url

        const headers = new Headers(incoming.headers)
        for (const name of HOP_BY_HOP) headers.delete(name)
        headers.set("x-forwarded-host", url.host)
        headers.set("x-forwarded-proto", url.protocol.slice(0, -1))
        if (request.remoteAddress._tag === "Some") headers.set("x-forwarded-for", request.remoteAddress.value)

        if (kind === "assets") {
          headers.delete("cookie")
          headers.delete("authorization")
        } else if (!COOKIE_SERVICES.has(service)) {
          const token = yield* tokens.forCookie(
            incoming.headers.get("cookie") ?? undefined,
            route.audience,
            route.scope,
          )
          headers.delete("cookie")
          headers.set("authorization", `Bearer ${token}`)
        }

        yield* Effect.annotateCurrentSpan({ "mosaik.service": service, "mosaik.proxy": kind })
        const response = yield* Effect.tryPromise({
          try: (signal) =>
            fetch(new URL(url.pathname + url.search, upstream), {
              method: kind === "assets" ? "GET" : incoming.method,
              headers,
              ...(kind === "assets" ? {} : { body: incoming.body }),
              redirect: "manual",
              signal,
              // Pass compressed bodies through untouched (content-encoding is preserved).
              decompress: false,
            }),
          catch: (cause) => cause,
        }).pipe(
          Effect.catch((cause) =>
            Effect.as(
              Effect.logWarning(`Upstream "${service}" unavailable`, cause),
              new Response(JSON.stringify({ _tag: "ServiceUnavailable", service }), {
                status: 502,
                headers: { "content-type": "application/json" },
              }),
            ),
          ),
        )
        return HttpServerResponse.fromWeb(response)
      })

    yield* router.add("*", "/api/*", forward("api"))
    yield* router.add("GET", "/apps/*", forward("assets"))
  }),
)

export const layer = ProxyRoute.pipe(Layer.provide([Upstreams.layer, Tokens.layer]))
