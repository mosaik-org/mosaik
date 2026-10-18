import { PgClient } from "@effect/sql-pg"
import { IssuedToken, TOKEN_ALGORITHM, TOKEN_ISSUER, TOKEN_TTL_SECONDS, type TokenClaims } from "@mosaik/auth/contract"
import { TokenVerifier } from "@mosaik/auth/server"
import { Clock, Context, Effect, Layer, Schema } from "effect"
import { SqlSchema } from "effect/sql"
import { createLocalJWKSet, exportJWK, generateKeyPair, importJWK, type JSONWebKeySet, type JWK, SignJWT } from "jose"

const KeyRow = Schema.Struct({
  kid: Schema.String,
  privateJwk: Schema.Record(Schema.String, Schema.Unknown),
  publicJwk: Schema.Record(Schema.String, Schema.Unknown),
})

/**
 * Ed25519 keys used to sign internal tokens. Generated on first start and stored in
 * the database; all keys are published as JWKS so they can be rotated by inserting
 * a new one (the newest key signs).
 */
export class SigningKeys extends Context.Service<
  SigningKeys,
  {
    readonly jwks: JSONWebKeySet
    /** Signs a token for one service (`audience`). */
    sign(claims: TokenClaims, audience: string): Effect.Effect<IssuedToken>
  }
>()("@mosaik/auth-service/SigningKeys") {
  static readonly layer = Layer.effect(
    SigningKeys,
    Effect.gen(function* () {
      const sql = yield* PgClient.PgClient
      const loadKeys = SqlSchema.findAll({
        Request: Schema.Void,
        Result: KeyRow,
        execute: () => sql`SELECT kid, private_jwk, public_jwk FROM signing_keys ORDER BY created_at DESC`,
      })

      let rows = yield* loadKeys()
      if (rows.length === 0) {
        const generated = yield* Effect.promise(async () => {
          const { privateKey, publicKey } = await generateKeyPair(TOKEN_ALGORITHM, {
            crv: "Ed25519",
            extractable: true,
          })
          return {
            kid: crypto.randomUUID(),
            privateJwk: await exportJWK(privateKey),
            publicJwk: await exportJWK(publicKey),
          }
        })
        yield* sql`
          INSERT INTO signing_keys (kid, private_jwk, public_jwk)
          VALUES (${generated.kid}, ${sql.json(generated.privateJwk)}, ${sql.json(generated.publicJwk)})
        `
        yield* Effect.logInfo("Generated a new token signing key")
        rows = yield* loadKeys()
      }

      const [current] = rows
      if (current === undefined) return yield* Effect.die("No signing key available")
      const privateKey = yield* Effect.promise(() => importJWK(current.privateJwk as JWK, TOKEN_ALGORITHM))
      const jwks: JSONWebKeySet = {
        keys: rows.map((row) => ({ ...(row.publicJwk as JWK), kid: row.kid, alg: TOKEN_ALGORITHM, use: "sig" })),
      }

      return SigningKeys.of({
        jwks,
        sign: Effect.fn("SigningKeys.sign")(function* (claims: TokenClaims, audience: string) {
          const now = yield* Clock.currentTimeMillis
          const issuedAt = Math.floor(now / 1000)
          const token = yield* Effect.promise(() =>
            new SignJWT({ ...claims })
              .setProtectedHeader({ alg: TOKEN_ALGORITHM, kid: current.kid })
              .setIssuer(TOKEN_ISSUER)
              .setAudience(audience)
              .setSubject(claims.user?.id ?? "anonymous")
              .setIssuedAt(issuedAt)
              .setExpirationTime(issuedAt + TOKEN_TTL_SECONDS)
              .sign(privateKey),
          )
          return new IssuedToken({
            token,
            expiresAt: (issuedAt + TOKEN_TTL_SECONDS) * 1000,
            userId: claims.user?.id ?? null,
          })
        }),
      })
    }),
  )

  /** The auth service verifies its own tokens (admin API) against the local key set. */
  static readonly verifierLayer = (audience: string) =>
    Layer.effect(
      TokenVerifier,
      Effect.gen(function* () {
        const keys = yield* SigningKeys
        return TokenVerifier.make(createLocalJWKSet(keys.jwks), audience)
      }),
    )
}
