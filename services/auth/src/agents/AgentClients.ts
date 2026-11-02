import { randomBytes } from "node:crypto"
import { PgClient } from "@effect/sql-pg"
import { Cache, Context, Data, Duration, Effect, Exit, Layer, Option, Schema } from "effect"
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/http"

/** An AI client someone can allow: who it says it is, and where sign-in may return to. */
export interface AgentClient {
  readonly id: string
  readonly name: string
  readonly redirectUris: ReadonlyArray<string>
  /**
   * For clients identified by a client ID metadata document: the domain that published it,
   * which the consent page shows (unlike a name, nobody else can claim it). `None` for clients
   * that registered themselves.
   */
  readonly domain: Option.Option<string>
}

/** Registration metadata the client sent, refused (RFC 7591 `invalid_client_metadata`, `invalid_redirect_uri`). */
export class InvalidClientMetadata extends Data.TaggedError("InvalidClientMetadata")<{
  readonly error: "invalid_client_metadata" | "invalid_redirect_uri"
  readonly description: string
}> {}

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"])

/** Schemes that run or read something instead of reaching an app. */
const UNSAFE_SCHEMES = new Set(["javascript:", "data:", "file:", "vbscript:", "blob:", "about:"])

/**
 * Where an AI client may ask sign-in to return to (RFC 8252, OAuth 2.1): an `https` address,
 * `http` only on this computer (clients on a laptop listen on a local port), or an app's own
 * scheme (`cursor://…`).
 */
export const isAllowedRedirect = (uri: string): boolean => {
  if (!URL.canParse(uri)) return false
  const url = new URL(uri)
  if (url.hash !== "" || url.username !== "" || url.password !== "") return false
  if (url.protocol === "https:") return true
  if (url.protocol === "http:") return LOOPBACK_HOSTS.has(url.hostname)
  return !UNSAFE_SCHEMES.has(url.protocol)
}

/**
 * Whether `requested` is one of the client's addresses: exactly, except that on this computer
 * any port is (RFC 8252 §7.3: local clients pick a free port each time).
 */
export const matchesRedirect = (requested: string, registered: ReadonlyArray<string>): boolean => {
  if (registered.includes(requested)) return true
  if (!URL.canParse(requested)) return false
  const url = new URL(requested)
  if (url.protocol !== "http:" || !LOOPBACK_HOSTS.has(url.hostname)) return false
  return registered.some((candidate) => {
    if (!URL.canParse(candidate)) return false
    const other = new URL(candidate)
    return (
      other.protocol === url.protocol &&
      other.hostname === url.hostname &&
      other.pathname === url.pathname &&
      other.search === url.search
    )
  })
}

/** Whether a client id is the address of a client ID metadata document: `https`, with a path. */
export const isMetadataDocumentId = (clientId: string): boolean => {
  if (!URL.canParse(clientId)) return false
  const url = new URL(clientId)
  return url.protocol === "https:" && url.pathname !== "/" && url.hash === "" && url.username === ""
}

const RegistrationMetadata = Schema.Struct({
  client_name: Schema.optional(Schema.String),
  redirect_uris: Schema.Array(Schema.String),
  token_endpoint_auth_method: Schema.optional(Schema.String),
})

const MetadataDocument = Schema.Struct({
  ...RegistrationMetadata.fields,
  client_id: Schema.String,
})

/** A client's name, as people read it: one line, not too long. */
const displayName = (name: string | undefined, fallback: string) => {
  const clean = (name ?? "").replace(/\s+/g, " ").trim().slice(0, 100)
  return clean === "" ? fallback : clean
}

const checkMetadata = (metadata: typeof RegistrationMetadata.Type) => {
  if (metadata.token_endpoint_auth_method !== undefined && metadata.token_endpoint_auth_method !== "none") {
    return Option.some(
      new InvalidClientMetadata({
        error: "invalid_client_metadata",
        description: "Only public clients are supported (token_endpoint_auth_method: none), with PKCE",
      }),
    )
  }
  if (metadata.redirect_uris.length === 0 || metadata.redirect_uris.length > 10) {
    return Option.some(
      new InvalidClientMetadata({ error: "invalid_redirect_uri", description: "Give 1 to 10 redirect URIs" }),
    )
  }
  const unsafe = metadata.redirect_uris.find((uri) => !isAllowedRedirect(uri))
  if (unsafe !== undefined) {
    return Option.some(
      new InvalidClientMetadata({
        error: "invalid_redirect_uri",
        description: `Not allowed: ${unsafe.slice(0, 200)} (use https, http on localhost, or the app's own scheme)`,
      }),
    )
  }
  return Option.none()
}

/** Client ID metadata documents are small; larger answers are refused. */
const MAX_DOCUMENT_BYTES = 5 * 1024

/** Registrations nobody allowed within a day, or unused for 90 days, are deleted. */
const UNUSED_REGISTRATION = Duration.days(1)
const IDLE_REGISTRATION = Duration.days(90)

/**
 * The AI clients people can allow. Both ways MCP clients identify themselves are supported, since
 * clients differ in which they use:
 *
 * - Client ID metadata documents: the client id is an `https` address where the client's vendor
 *   publishes its name and redirect URIs. Nothing is stored; documents are cached for a few minutes.
 * - Dynamic client registration (RFC 7591): the client registers its name and redirect URIs and
 *   gets an id. Anyone can register any name, so the consent page says it is unverified.
 */
export class AgentClients extends Context.Service<
  AgentClients,
  {
    readonly register: (metadata: unknown) => Effect.Effect<AgentClient, InvalidClientMetadata>
    readonly find: (clientId: string) => Effect.Effect<Option.Option<AgentClient>>
    /** Someone allowed the client: keeps a registration from being cleared out. */
    readonly markUsed: (clientId: string) => Effect.Effect<void>
  }
>()("@mosaik/auth-service/AgentClients") {
  static readonly layer = Layer.effect(
    AgentClients,
    Effect.gen(function* () {
      const sql = yield* PgClient.PgClient
      const http = yield* HttpClient.HttpClient

      const fetchDocument = Effect.fn("AgentClients.fetchDocument")(function* (clientId: string) {
        // Not followed: a redirect would let the document's address lead Core somewhere else.
        const response = yield* http
          .execute(HttpClientRequest.get(clientId).pipe(HttpClientRequest.acceptJson))
          .pipe(Effect.provideService(FetchHttpClient.RequestInit, { redirect: "manual" }))
        if (response.status !== 200) return Option.none<AgentClient>()
        if (Number(response.headers["content-length"] ?? 0) > MAX_DOCUMENT_BYTES) return Option.none<AgentClient>()
        const body = yield* response.text
        if (body.length > MAX_DOCUMENT_BYTES) return Option.none<AgentClient>()
        const document = yield* Schema.decodeUnknownEffect(Schema.fromJsonString(MetadataDocument))(body)
        // The document must name itself: another address cannot pose as this client.
        if (document.client_id !== clientId || Option.isSome(checkMetadata(document))) return Option.none<AgentClient>()
        const domain = new URL(clientId).hostname
        return Option.some<AgentClient>({
          id: clientId,
          name: displayName(document.client_name, domain),
          redirectUris: document.redirect_uris,
          domain: Option.some(domain),
        })
      })

      // Unreachable or invalid documents are remembered briefly too, so a broken client cannot make Core fetch on every request.
      const documents = yield* Cache.makeWith(
        (clientId: string) =>
          fetchDocument(clientId).pipe(
            Effect.timeout(Duration.seconds(5)),
            Effect.catch((error) =>
              Effect.as(Effect.logInfo("Unusable client ID metadata document", { clientId, error }), Option.none()),
            ),
          ),
        {
          capacity: 1_000,
          timeToLive: (exit) =>
            Exit.isSuccess(exit) && Option.isSome(exit.value) ? Duration.minutes(5) : Duration.seconds(30),
        },
      )

      const registered = Effect.fn("AgentClients.registered")(function* (clientId: string) {
        const [row] = yield* sql<{ id: string; name: string; redirectUris: ReadonlyArray<string> }>`
          SELECT id, name, redirect_uris FROM agent_clients WHERE id = ${clientId}
        `.pipe(Effect.orDie)
        return Option.map(Option.fromUndefinedOr(row), (row): AgentClient => ({ ...row, domain: Option.none() }))
      })

      return AgentClients.of({
        register: Effect.fn("AgentClients.register")(function* (input) {
          const metadata = yield* Schema.decodeUnknownEffect(RegistrationMetadata)(input).pipe(
            Effect.mapError(
              () =>
                new InvalidClientMetadata({
                  error: "invalid_client_metadata",
                  description: "Expected client_name and redirect_uris",
                }),
            ),
          )
          const invalid = checkMetadata(metadata)
          if (Option.isSome(invalid)) return yield* invalid.value
          const client: AgentClient = {
            id: `mosaik-${randomBytes(16).toString("base64url")}`,
            name: displayName(metadata.client_name, "Unnamed AI client"),
            redirectUris: metadata.redirect_uris,
            domain: Option.none(),
          }
          yield* sql`
            INSERT INTO agent_clients ${sql.insert({ id: client.id, name: client.name, redirectUris: client.redirectUris })}
          `.pipe(Effect.orDie)
          // Anyone can register: what nobody uses goes.
          yield* sql`
            DELETE FROM agent_clients
            WHERE (last_used_at IS NULL AND created_at < now() - ${`${Duration.toSeconds(UNUSED_REGISTRATION)} seconds`}::interval)
               OR last_used_at < now() - ${`${Duration.toSeconds(IDLE_REGISTRATION)} seconds`}::interval
          `.pipe(Effect.orDie)
          return client
        }),

        find: (clientId) => (isMetadataDocumentId(clientId) ? Cache.get(documents, clientId) : registered(clientId)),

        markUsed: (clientId) =>
          sql`UPDATE agent_clients SET last_used_at = now() WHERE id = ${clientId}`.pipe(Effect.asVoid, Effect.orDie),
      })
    }),
  ).pipe(Layer.provide(FetchHttpClient.layer))
}
