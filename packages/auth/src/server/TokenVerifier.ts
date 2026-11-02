import { Principal, Unauthorized } from "@mosaik/core"
import { Config, Context, Effect, Layer, Schema } from "effect"
import { createRemoteJWKSet, type JWTVerifyGetKey, jwtVerify } from "jose"
import { JWKS_PATH, TOKEN_ALGORITHM, TOKEN_ISSUER, TokenClaims } from "../contract/token"

/**
 * The claims of a token signed by the auth service for `audience`, decoded with `schema`; fails
 * with `Unauthorized` when the token is forged, expired, for another audience or malformed.
 */
export const verifyToken = <S extends Schema.Decoder<unknown>>(
  getKey: JWTVerifyGetKey,
  audience: string,
  schema: S,
): ((token: string) => Effect.Effect<S["Type"], Unauthorized, S["DecodingServices"]>) => {
  const invalid = () => new Unauthorized({ message: "Invalid or expired token" })
  const decode = Schema.decodeUnknownEffect(schema)
  return Effect.fn("verifyToken")(function* (token: string) {
    const { payload } = yield* Effect.tryPromise({
      try: () => jwtVerify(token, getKey, { issuer: TOKEN_ISSUER, audience, algorithms: [TOKEN_ALGORITHM] }),
      catch: invalid,
    })
    return yield* decode(payload).pipe(Effect.mapError(invalid))
  })
}

/** Verifies internal tokens issued for this service (`audience`) and turns them into principals. */
export class TokenVerifier extends Context.Service<
  TokenVerifier,
  { verify(token: string): Effect.Effect<Principal, Unauthorized> }
>()("@mosaik/auth/TokenVerifier") {
  static make(getKey: JWTVerifyGetKey, audience: string): TokenVerifier["Service"] {
    const claims = verifyToken(getKey, audience, TokenClaims)
    return TokenVerifier.of({
      verify: (token) => Effect.map(claims(token), (claims) => new Principal(claims)),
    })
  }

  /** Verifies against a published JWKS. Keys are cached and rotated by `jose`. */
  static readonly layerJwks = (audience: string, jwksUrl: Config.Config<URL>) =>
    Layer.effect(
      TokenVerifier,
      Effect.gen(function* () {
        return TokenVerifier.make(createRemoteJWKSet(yield* jwksUrl), audience)
      }),
    )

  /** Verifies against the auth service's JWKS (`AUTH_URL`), for platform services. */
  static readonly layerRemote = (audience: string) =>
    TokenVerifier.layerJwks(audience, Config.URL("AUTH_URL").pipe(Config.map((authUrl) => new URL(JWKS_PATH, authUrl))))
}
