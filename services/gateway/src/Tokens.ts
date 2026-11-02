import { ACCESS_STREAM_PATH, AccessChange, SESSION_COOKIE_NAMES } from "@mosaik/auth/contract"
import { InternalClient } from "@mosaik/auth/server"
import { followEventStream } from "@mosaik/server"
import { Cache, Clock, Config, Context, Duration, Effect, Exit, Layer } from "effect"
import { FetchHttpClient } from "effect/http"

/** Refresh tokens a little before they expire, so upstreams never see an expired one. */
const EXPIRY_MARGIN_MS = 10_000

/**
 * Extracts the session cookie (`name=value`) from a Cookie header.
 * Only the session cookie identifies a principal; other cookies must not split the cache.
 */
export const sessionCookie = (cookieHeader: string | undefined): string => {
  if (!cookieHeader) return ""
  for (const part of cookieHeader.split(";")) {
    const cookie = part.trim()
    const name = cookie.slice(0, cookie.indexOf("="))
    if (SESSION_COOKIE_NAMES.includes(name)) return cookie
  }
  return ""
}

interface TokenRequest {
  readonly cookie: string
  readonly audience: string
  readonly scope: string | null
}

/**
 * Internal tokens per session and service, cached until shortly before they expire, or
 * until the auth service says the user's access changed (their roles, a role's grants,
 * a session that ended): the next request then gets a token with their access as it is.
 */
export class Tokens extends Context.Service<
  Tokens,
  {
    /** A token for one service (`audience`); `scope` limits the grants to an app's own. */
    forCookie(cookieHeader: string | undefined, audience: string, scope: string | null): Effect.Effect<string>
  }
>()("@mosaik/gateway/Tokens") {
  static readonly layer = Layer.effect(
    Tokens,
    Effect.gen(function* () {
      const client = yield* InternalClient
      // Keyed by a string so equal requests share an entry.
      const cache = yield* Cache.makeWith(
        (key: string) =>
          Effect.gen(function* () {
            const { cookie, audience, scope } = JSON.parse(key) as TokenRequest
            const issued = yield* client.internal.issueToken({
              payload: { cookie: cookie === "" ? null : cookie, audience, scope },
            })
            return { token: issued.token, expiresAt: issued.expiresAt, userId: issued.userId }
          }).pipe(Effect.withSpan("Tokens.issue")),
        {
          capacity: 10_000,
          timeToLive: (exit) =>
            Exit.isSuccess(exit)
              ? Duration.millis(Math.max(0, exit.value.expiresAt - Date.now() - EXPIRY_MARGIN_MS))
              : Duration.zero,
        },
      )

      // Each connection starts with a change for everyone: tokens cached while it was down are dropped too.
      const forget = Effect.fn("Tokens.forget")(function* (change: AccessChange) {
        if (change.user === null) return yield* Cache.invalidateAll(cache)
        for (const [key, value] of yield* Cache.entries(cache)) {
          if (value.userId === change.user) yield* Cache.invalidate(cache, key)
        }
      })
      yield* followEventStream({
        name: "Access change",
        url: new URL(ACCESS_STREAM_PATH, yield* Config.URL("AUTH_URL")),
        key: yield* Config.Redacted("INTERNAL_KEY"),
        schema: AccessChange,
        onEvent: forget,
      })

      return Tokens.of({
        forCookie: Effect.fn("Tokens.forCookie")(function* (
          cookieHeader: string | undefined,
          audience: string,
          scope: string | null,
        ) {
          const key = JSON.stringify({ cookie: sessionCookie(cookieHeader), audience, scope } satisfies TokenRequest)
          const { token, expiresAt } = yield* Cache.get(cache, key).pipe(Effect.orDie)
          const now = yield* Clock.currentTimeMillis
          if (expiresAt - now > 0) return token
          // Clock skew or a stale entry: fetch a fresh token.
          yield* Cache.invalidate(cache, key)
          return (yield* Cache.get(cache, key).pipe(Effect.orDie)).token
        }),
      })
    }),
  ).pipe(Layer.provide(FetchHttpClient.layer))
}
