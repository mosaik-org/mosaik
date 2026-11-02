import {
  AGENT_AUDIENCE,
  AGENT_RESOURCE_PATH,
  AgentTokenClaims,
  JWKS_PATH,
  PROTECTED_RESOURCE_METADATA_PATH,
} from "@mosaik/auth/contract"
import { verifyToken } from "@mosaik/auth/server"
import { Config, Effect, Layer, Option } from "effect"
import { HttpRouter, type HttpServerRequest, HttpServerResponse } from "effect/http"
import { createRemoteJWKSet } from "jose"
import { AgentServers } from "./AgentServers"

/** The access token of `Authorization: Bearer <token>`. */
const bearer = (request: HttpServerRequest.HttpServerRequest): Option.Option<string> => {
  const match = /^Bearer\s+(\S+)$/i.exec(request.headers.authorization ?? "")
  return Option.fromNullishOr(match?.[1])
}

/**
 * The MCP endpoint (`AGENT_RESOURCE_PATH`) and its OAuth protected-resource metadata (RFC 9728).
 * Requests need an AI client's access token from Core's sign-in; without a valid one, the answer
 * is 401 with where to find the metadata, from which clients find where to sign in.
 */
export const AgentRoutes = HttpRouter.use(
  Effect.fn(function* (router) {
    const servers = yield* AgentServers
    const publicUrl = yield* Config.URL("PUBLIC_URL")
    const resource = new URL(AGENT_RESOURCE_PATH, publicUrl).href
    const metadataUrl = new URL(PROTECTED_RESOURCE_METADATA_PATH, publicUrl).href
    const verify = verifyToken(
      createRemoteJWKSet(new URL(JWKS_PATH, yield* Config.URL("AUTH_URL"))),
      AGENT_AUDIENCE,
      AgentTokenClaims,
    )

    const unauthorized = (description: string) =>
      HttpServerResponse.jsonUnsafe(
        { error: "invalid_token", error_description: description },
        {
          status: 401,
          headers: {
            "www-authenticate": `Bearer resource_metadata="${metadataUrl}", error="invalid_token", error_description="${description}"`,
          },
        },
      )

    const metadata = HttpServerResponse.jsonUnsafe(
      {
        resource,
        // Core signs people in: the auth service, on Core's public address.
        authorization_servers: [publicUrl.origin],
        bearer_methods_supported: ["header"],
        resource_name: "Mosaik",
      },
      { headers: { "cache-control": "public, max-age=300" } },
    )
    yield* router.add("GET", PROTECTED_RESOURCE_METADATA_PATH, Effect.succeed(metadata))

    yield* router.add(
      "*",
      AGENT_RESOURCE_PATH,
      Effect.fn("Agent.request")(function* (request: HttpServerRequest.HttpServerRequest) {
        const token = bearer(request)
        if (Option.isNone(token)) return unauthorized("Sign in to Mosaik")
        return yield* verify(token.value).pipe(
          Effect.matchEffect({
            onFailure: () => Effect.succeed(unauthorized("The access token is invalid or has expired")),
            onSuccess: (claims) =>
              Effect.annotateCurrentSpan({ "mosaik.user": claims.user.id }).pipe(
                Effect.andThen(servers.handle(claims)),
              ),
          }),
        )
      }),
    )
  }),
)

export const layer = AgentRoutes.pipe(Layer.provide(AgentServers.layer))
