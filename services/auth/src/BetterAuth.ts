import { AuthProviders, COOKIE_PREFIX } from "@mosaik/auth/contract"
import { Conflict, PrincipalUser, UserId } from "@mosaik/core"
import { type BetterAuthOptions, betterAuth } from "better-auth"
import { getMigrations } from "better-auth/db/migration"
import { Context, Effect, Layer, Option, Redacted, Schema } from "effect"
import { Pool } from "pg"
import { AuthConfig } from "./AuthConfig"

/** Failure inside Better Auth; unexpected at our boundaries, so usually turned into a defect. */
export class AuthBackendError extends Schema.TaggedError<AuthBackendError>()("AuthBackendError", {
  cause: Schema.Defect(),
}) {}

export interface CreatePasswordUser {
  readonly email: string
  readonly name: string
  readonly password: Redacted.Redacted<string>
}

/**
 * Better Auth behind an Effect service: sessions, password login and Entra ID SSO.
 * The rest of the service never touches Better Auth directly.
 */
export class BetterAuth extends Context.Service<
  BetterAuth,
  {
    readonly providers: AuthProviders
    /** Handles `/api/auth/*` (sign-in, sign-out, OAuth callbacks, ...). */
    handler(request: Request): Promise<Response>
    getSessionUser(headers: Headers): Effect.Effect<Option.Option<PrincipalUser>, AuthBackendError>
    /** The session behind these headers (its cookie), and whose it is. */
    getSession(
      headers: Headers,
    ): Effect.Effect<Option.Option<{ readonly id: string; readonly user: PrincipalUser }>, AuthBackendError>
    /** Signs in with a password; on success the response sets the session cookie. */
    signInWithPassword(email: string, password: string, headers: Headers): Effect.Effect<Response, AuthBackendError>
    /**
     * Starts signing in with Microsoft: the URL to send the browser to, and the response whose
     * cookies (the flow's state) must reach the browser too.
     */
    startMicrosoftSignIn(
      callbackUrl: string,
      errorUrl: string,
      headers: Headers,
    ): Effect.Effect<{ readonly url: string; readonly response: Response }, AuthBackendError>
    createPasswordUser(input: CreatePasswordUser): Effect.Effect<UserId, Conflict | AuthBackendError>
    deleteUser(userId: UserId): Effect.Effect<void, AuthBackendError>
  }
>()("@mosaik/auth-service/BetterAuth") {
  static readonly layer = Layer.effect(
    BetterAuth,
    Effect.gen(function* () {
      const config = yield* AuthConfig
      const pool = yield* Effect.acquireRelease(
        Effect.sync(() => new Pool({ connectionString: Redacted.value(config.databaseUrl), max: 5 })),
        (pool) => Effect.promise(() => pool.end()),
      )

      const microsoft = Option.getOrUndefined(config.microsoft)
      const options = {
        appName: "Mosaik",
        baseURL: config.publicUrl,
        basePath: "/api/auth",
        secret: Redacted.value(config.secret),
        database: pool,
        trustedOrigins: [config.publicUrl],
        telemetry: { enabled: false },
        advanced: { cookiePrefix: COOKIE_PREFIX },
        // Accounts are created by admins (or by Entra ID sign-in); no public sign-up.
        emailAndPassword: { enabled: true, disableSignUp: true },
        account: { accountLinking: { enabled: true, trustedProviders: ["microsoft"] } },
        socialProviders: microsoft
          ? {
              microsoft: {
                clientId: microsoft.clientId,
                clientSecret: Redacted.value(microsoft.clientSecret),
                tenantId: microsoft.tenantId,
                disableImplicitSignUp: !microsoft.allowSignUp,
              },
            }
          : {},
      } satisfies BetterAuthOptions

      yield* Effect.tryPromise({
        try: async () => (await getMigrations(options)).runMigrations(),
        catch: (cause) => new AuthBackendError({ cause }),
      }).pipe(Effect.withSpan("BetterAuth.migrate"))

      const auth = betterAuth(options)
      const attempt = <A>(f: () => Promise<A>) =>
        Effect.tryPromise({ try: f, catch: (cause) => new AuthBackendError({ cause }) })

      const getSession = Effect.fn("BetterAuth.getSession")(function* (headers: Headers) {
        const session = yield* attempt(() => auth.api.getSession({ headers }))
        if (session === null) return Option.none()
        const { user } = session
        return Option.some({
          id: session.session.id,
          user: new PrincipalUser({
            id: UserId.make(user.id),
            email: user.email,
            name: user.name,
            image: user.image ?? null,
          }),
        })
      })

      return BetterAuth.of({
        providers: new AuthProviders({ password: true, microsoft: microsoft !== undefined }),

        handler: (request) => auth.handler(request),

        getSessionUser: (headers) =>
          Effect.map(
            getSession(headers),
            Option.map((session) => session.user),
          ),

        getSession,

        signInWithPassword: (email, password, headers) =>
          attempt(() => auth.api.signInEmail({ body: { email, password }, headers, asResponse: true })),

        startMicrosoftSignIn: Effect.fn("BetterAuth.startMicrosoftSignIn")(function* (callbackUrl, errorUrl, headers) {
          const response = yield* attempt(() =>
            auth.api.signInSocial({
              body: { provider: "microsoft", callbackURL: callbackUrl, errorCallbackURL: errorUrl },
              headers,
              asResponse: true,
            }),
          )
          const { url } = (yield* attempt(() => response.clone().json())) as { url?: string }
          if (!response.ok || url === undefined) {
            return yield* new AuthBackendError({ cause: `Microsoft sign-in did not start (HTTP ${response.status})` })
          }
          return { url, response }
        }),

        createPasswordUser: Effect.fn("BetterAuth.createPasswordUser")(function* (input: CreatePasswordUser) {
          const context = yield* attempt(() => auth.$context)
          const email = input.email.trim().toLowerCase()
          const existing = yield* attempt(() => context.internalAdapter.findUserByEmail(email))
          if (existing !== null) {
            return yield* new Conflict({ message: `A user with email ${email} already exists` })
          }
          const user = yield* attempt(() =>
            context.internalAdapter.createUser({ email, name: input.name, emailVerified: true }, { method: "admin" }),
          )
          const hash = yield* attempt(() => context.password.hash(Redacted.value(input.password)))
          yield* attempt(() =>
            context.internalAdapter.linkAccount({
              userId: user.id,
              providerId: "credential",
              accountId: user.id,
              password: hash,
            }),
          )
          return UserId.make(user.id)
        }),

        deleteUser: Effect.fn("BetterAuth.deleteUser")(function* (userId: UserId) {
          const context = yield* attempt(() => auth.$context)
          yield* attempt(() => context.internalAdapter.deleteUserSessions(userId))
          yield* attempt(() => context.internalAdapter.deleteUser(userId))
        }),
      })
    }),
  )
}
