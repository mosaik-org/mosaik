import { Principal, Unauthorized } from "@mosaik/core"
import { Config, Context, Effect, Layer, Schema } from "effect"
import { createRemoteJWKSet, type JWTVerifyGetKey, jwtVerify } from "jose"
import { JWKS_PATH, TOKEN_ALGORITHM, TOKEN_ISSUER, TokenClaims } from "../contract/token"

const decodeClaims = Schema.decodeUnknownEffect(TokenClaims)

/** Verifies internal tokens issued for this service (`audience`) and turns them into principals. */
export class TokenVerifier extends Context.Service<
  TokenVerifier,
  { verify(token: string): Effect.Effect<Principal, Unauthorized> }
>()("@mosaik/auth/TokenVerifier") {
  static make(getKey: JWTVerifyGetKey, audience: string): TokenVerifier["Service"] {
    const invalid = () => new Unauthorized({ message: "Invalid or expired token" })
    return TokenVerifier.of({
      verify: Effect.fn("TokenVerifier.verify")(function* (token: string) {
        const { payload } = yield* Effect.tryPromise({
          try: () =>
            jwtVerify(token, getKey, {
              issuer: TOKEN_ISSUER,
              audience,
              algorithms: [TOKEN_ALGORITHM],
            }),
          catch: invalid,
        })
        const claims = yield* decodeClaims(payload).pipe(Effect.mapError(invalid))
        return new Principal(claims)
      }),
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
