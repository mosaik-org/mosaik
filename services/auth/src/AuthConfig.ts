import { Database } from "@mosaik/db"
import { Config, Context, Effect, Layer, Option, type Redacted } from "effect"

export interface MicrosoftConfig {
  readonly clientId: string
  readonly clientSecret: Redacted.Redacted<string>
  readonly tenantId: string
  /** Create accounts on first Entra ID login (users get the `authenticated` role only). */
  readonly allowSignUp: boolean
}

export interface BootstrapAdmin {
  readonly email: string
  readonly password: Redacted.Redacted<string>
}

/** Auth service configuration, read from the environment. */
export class AuthConfig extends Context.Service<
  AuthConfig,
  {
    /** Public origin of the app (what the browser sees), e.g. `https://mosaik.example.com`. */
    readonly publicUrl: string
    readonly secret: Redacted.Redacted<string>
    readonly databaseUrl: Redacted.Redacted<string>
    readonly microsoft: Option.Option<MicrosoftConfig>
    readonly bootstrapAdmin: Option.Option<BootstrapAdmin>
  }
>()("@mosaik/auth-service/AuthConfig") {
  static readonly layer = Layer.effect(
    AuthConfig,
    Effect.gen(function* () {
      // Docker compose passes unset optional variables as empty strings.
      const microsoft = yield* Config.all({
        clientId: Config.String("ENTRA_CLIENT_ID"),
        clientSecret: Config.Redacted("ENTRA_CLIENT_SECRET"),
        tenantId: Config.String("ENTRA_TENANT_ID"),
        allowSignUp: Config.Boolean("ENTRA_ALLOW_SIGNUP").pipe(Config.withDefault(true)),
      }).pipe(
        Config.option,
        Config.map(Option.filter((entra) => entra.clientId.length > 0 && entra.tenantId.length > 0)),
      )

      const bootstrapAdmin = yield* Config.all({
        email: Config.String("ADMIN_EMAIL"),
        password: Config.Redacted("ADMIN_PASSWORD"),
      }).pipe(Config.option, Config.map(Option.filter((admin) => admin.email.length > 0)))

      return AuthConfig.of({
        publicUrl: yield* Config.String("PUBLIC_URL"),
        secret: yield* Config.Redacted("AUTH_SECRET"),
        databaseUrl: yield* Database.url("auth"),
        microsoft,
        bootstrapAdmin,
      })
    }),
  )
}
