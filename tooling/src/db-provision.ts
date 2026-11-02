/**
 * Creates a role + database for the services (Core's auth, notifications, platform and assistant, and the Portal) and every built-in app whose
 * manifest sets `database: true`, plus the examples' in development. Idempotent; run by `bun dev` and by the compose
 * `provision` job.
 *
 *   bun db:provision            uses POSTGRES_URL / DB_PASSWORD_SECRET (dev defaults if unset)
 */

import { PgClient } from "@effect/sql-pg"
import { provisionDatabase } from "@mosaik/db"
import { Effect, Redacted, Schedule } from "effect"
import { env } from "./env"
import { discoverApps, discoverExamples } from "./workspace"

export const provisionAll = async (options: { readonly examples?: boolean } = {}): Promise<void> => {
  const apps = [...(await discoverApps()), ...(options.examples ? await discoverExamples() : [])]
  const services = [
    "auth",
    "notifications",
    "platform",
    "assistant",
    "portal",
    ...apps.filter((d) => d.manifest.database).map((d) => d.manifest.id),
  ]
  const secret = Redacted.make(env("DB_PASSWORD_SECRET"))

  const program = Effect.forEach(services, (id) => provisionDatabase(id, secret), { discard: true }).pipe(
    Effect.provide(PgClient.layer({ url: Redacted.make(env("POSTGRES_URL")), applicationName: "mosaik-provision" })),
    // Postgres may still be starting (docker compose up).
    Effect.retry({ schedule: Schedule.spaced("1 second"), times: 20 }),
  )
  await Effect.runPromise(program)
}

if (import.meta.main) {
  await provisionAll()
  console.log("Databases provisioned")
}
