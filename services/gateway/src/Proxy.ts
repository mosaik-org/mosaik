import { AGENT_RESOURCE_PATH } from "@mosaik/auth/contract"
import { Effect, Layer } from "effect"
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/http"
import { Tokens } from "./Tokens"
import { type Route, Upstreams } from "./Upstreams"

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
 * What a forwarded request carries:
 * - `token`: a short-lived signed token for the upstream, in place of the session cookie;
 * - `cookie`: the session cookie itself (the auth service, which reads it with Better Auth);
 * - `bearer`: the caller's own `Authorization` (AI clients' access tokens), never the cookie;
 * - `none`: no credentials at all (browser bundles, public metadata).
 */
type Credentials = "token" | "cookie" | "bearer" | "none"

/**
 * `/api/<service>/*` → upstream service. Cookies never leave the gateway (except to
 * the auth service); every other upstream receives a short-lived signed token, issued
 * for that service only. `/apps/<id>/*` → the app's browser bundle. `/mcp` → the MCP server,
 * with the AI client's own token, and the OAuth metadata AI clients discover it with.
 */
export const ProxyRoute = HttpRouter.use(
  Effect.fn(function* (router) {
    const upstreams = yield* Upstreams
    const tokens = yield* Tokens

    /** Forwards a request to `service`'s upstream, with `credentials`. */
    const forward = (
      request: HttpServerRequest.HttpServerRequest,
      service: string,
      route: Route,
      credentials: Credentials,
    ) =>
      Effect.gen(function* () {
        const incoming = yield* HttpServerRequest.toWeb(request).pipe(Effect.orDie)
        const url = new URL(incoming.url)

        const headers = new Headers(incoming.headers)
        for (const name of HOP_BY_HOP) headers.delete(name)
        headers.set("x-forwarded-host", url.host)
        headers.set("x-forwarded-proto", url.protocol.slice(0, -1))
        if (request.remoteAddress._tag === "Some") headers.set("x-forwarded-for", request.remoteAddress.value)

        if (credentials !== "cookie") headers.delete("cookie")
        if (credentials === "none") headers.delete("authorization")
        if (credentials === "token") {
          const token = yield* tokens.forCookie(
            incoming.headers.get("cookie") ?? undefined,
            route.audience,
            route.scope,
          )
          headers.set("authorization", `Bearer ${token}`)
        }

        const bodiless = incoming.method === "GET" || incoming.method === "HEAD"
        yield* Effect.annotateCurrentSpan({ "mosaik.service": service, "mosaik.credentials": credentials })
        const response = yield* Effect.tryPromise({
          try: (signal) =>
            fetch(new URL(url.pathname + url.search, route.url), {
              method: incoming.method,
              headers,
              ...(bodiless ? {} : { body: incoming.body }),
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

    /** `/<kind>/<service>/*`: the service named by the second path segment. */
    const byPath = (kind: "api" | "assets") =>
      Effect.fn("Gateway.proxy")(function* (request: HttpServerRequest.HttpServerRequest) {
        const service = new URL(request.url, "http://gateway").pathname.split("/")[2] ?? ""
        const route = yield* upstreams.resolve(service)
        // Only apps (not platform services) have browser bundles.
        if (route === undefined || (kind === "assets" && route.scope === null)) return notFound(service)
        if (kind === "assets") return yield* forward(request, service, route, "none")
        return yield* forward(request, service, route, COOKIE_SERVICES.has(service) ? "cookie" : "token")
      })

    /** A fixed platform service. */
    const to = (service: string, credentials: Credentials) =>
      Effect.fn("Gateway.proxy")(function* (request: HttpServerRequest.HttpServerRequest) {
        const route = yield* upstreams.resolve(service)
        if (route === undefined || route.scope !== null) return notFound(service)
        return yield* forward(request, service, route, credentials)
      })

    yield* router.add("*", "/api/*", byPath("api"))
    yield* router.add("GET", "/apps/*", byPath("assets"))
    yield* router.add("*", AGENT_RESOURCE_PATH, to("mcp", "bearer"))
    yield* router.add("GET", "/.well-known/oauth-protected-resource/*", to("mcp", "none"))
    yield* router.add("GET", "/.well-known/oauth-authorization-server", to("auth", "none"))
  }),
)

export const layer = ProxyRoute.pipe(Layer.provide([Upstreams.layer, Tokens.layer]))
