import { Cache, Duration, Effect, Exit, Redacted, Schema } from "effect"
import { HttpClient, HttpClientRequest, HttpClientResponse } from "effect/http"
import { type ConnectorError, toConnectorError } from "./ConnectorError"

/** Adds credentials to every request of a connector. */
export type Authenticator = (
  request: HttpClientRequest.HttpClientRequest,
) => Effect.Effect<HttpClientRequest.HttpClientRequest, ConnectorError>

/** An authentication strategy; built once per connector (it may cache tokens). */
export interface Auth {
  readonly make: (connector: string) => Effect.Effect<Authenticator, never, HttpClient.HttpClient>
}

const of = (
  authenticate: (request: HttpClientRequest.HttpClientRequest) => HttpClientRequest.HttpClientRequest,
): Auth => ({
  make: () => Effect.succeed((request) => Effect.succeed(authenticate(request))),
})

export const none: Auth = of((request) => request)

/** `Authorization: Bearer <token>`, e.g. Jira Data Center personal access tokens. */
export const bearer = (token: Redacted.Redacted<string>): Auth =>
  of((request) => HttpClientRequest.bearerToken(request, Redacted.value(token)))

/** HTTP basic auth, e.g. Jira Cloud (email + API token). */
export const basic = (username: string, password: Redacted.Redacted<string>): Auth =>
  of((request) => HttpClientRequest.basicAuth(request, username, Redacted.value(password)))

/** A secret in a custom header, e.g. `x-api-key`. */
export const header = (name: string, value: Redacted.Redacted<string>): Auth =>
  of((request) => HttpClientRequest.setHeader(request, name, Redacted.value(value)))

const TokenResponse = Schema.Struct({
  access_token: Schema.String,
  expires_in: Schema.Number,
})

/** Refresh tokens this long before they expire. */
const EXPIRY_MARGIN = Duration.seconds(60)

export interface ClientCredentialsOptions {
  readonly tokenUrl: string
  readonly clientId: string
  readonly clientSecret: Redacted.Redacted<string>
  readonly scope?: string
}

/**
 * OAuth 2.0 client credentials (service-to-service). The access token is cached and
 * refreshed shortly before it expires; concurrent requests share one token request.
 */
export const clientCredentials = (options: ClientCredentialsOptions): Auth => ({
  make: (connector) =>
    Effect.gen(function* () {
      const client = yield* HttpClient.HttpClient
      const fetchToken = HttpClientRequest.post(options.tokenUrl).pipe(
        HttpClientRequest.bodyUrlParams({
          grant_type: "client_credentials",
          client_id: options.clientId,
          client_secret: Redacted.value(options.clientSecret),
          ...(options.scope ? { scope: options.scope } : {}),
        }),
        client.execute,
        Effect.flatMap(HttpClientResponse.filterStatusOk),
        Effect.flatMap(HttpClientResponse.schemaBodyJson(TokenResponse)),
        Effect.mapError(toConnectorError(connector)),
        Effect.withSpan(`${connector}.token`),
      )
      const tokens = yield* Cache.makeWith((_: "token") => fetchToken, {
        capacity: 1,
        timeToLive: (exit) =>
          Exit.isSuccess(exit)
            ? Duration.subtract(Duration.seconds(exit.value.expires_in), EXPIRY_MARGIN)
            : Duration.zero,
      })
      return (request) =>
        Cache.get(tokens, "token").pipe(
          Effect.map((token) => HttpClientRequest.bearerToken(request, token.access_token)),
        )
    }),
})

/** Microsoft Entra ID app-only tokens, e.g. for Microsoft Graph (`https://graph.microsoft.com/.default`). */
export const entra = (options: Omit<ClientCredentialsOptions, "tokenUrl"> & { readonly tenantId: string }): Auth =>
  clientCredentials({
    ...options,
    tokenUrl: `https://login.microsoftonline.com/${options.tenantId}/oauth2/v2.0/token`,
  })
