import { PgClient } from "@effect/sql-pg"
import { BadRequest } from "@mosaik/core"
import { dropDatabase, provisionDatabase, serviceDatabaseUrl } from "@mosaik/db"
import { Context, Effect, Layer, Option, type Redacted } from "effect"
import type { SqlClient } from "effect/sql"
import { type DatabaseAdmin, PlatformConfig } from "./PlatformConfig"

/** Databases on Core's Postgres for apps that ask for one (`mosaik_<id>`), each with its own user. */
export class Provisioner extends Context.Service<
  Provisioner,
  {
    readonly available: boolean
    /** Creates the database (idempotent) and returns its URL as apps reach it. */
    provision(appId: string): Effect.Effect<Redacted.Redacted<string>, BadRequest>
    drop(appId: string): Effect.Effect<void, BadRequest>
  }
>()("@mosaik/platform-service/Provisioner") {
  static readonly layer = Layer.effect(
    Provisioner,
    Effect.gen(function* () {
      const { databaseAdmin } = yield* PlatformConfig
      if (Option.isNone(databaseAdmin)) {
        yield* Effect.logWarning(
          "Databases for apps are not available (POSTGRES_URL, DB_PASSWORD_SECRET, APP_DB_SERVER_URL); apps must bring their own",
        )
      }

      /** Runs with a short-lived superuser connection; provisioning is rare. */
      const asAdmin = <A, E>(
        effect: (admin: DatabaseAdmin) => Effect.Effect<A, E, PgClient.PgClient | SqlClient.SqlClient>,
      ) =>
        Option.match(databaseAdmin, {
          onNone: () => Effect.fail(new BadRequest({ message: "Databases for apps are not configured" })),
          onSome: (admin) =>
            effect(admin).pipe(
              Effect.provide(PgClient.layer({ url: admin.url, applicationName: "mosaik-platform-provisioner" })),
              Effect.mapError(
                (error) => new BadRequest({ message: error instanceof Error ? error.message : String(error) }),
              ),
            ),
        })

      return Provisioner.of({
        available: Option.isSome(databaseAdmin),
        provision: (appId) =>
          asAdmin((admin) =>
            provisionDatabase(appId, admin.passwordSecret).pipe(
              Effect.as(serviceDatabaseUrl(admin.appServerUrl, admin.passwordSecret, appId)),
            ),
          ),
        drop: (appId) => asAdmin(() => dropDatabase(appId)),
      })
    }),
  )
}
