import { PgClient } from "@effect/sql-pg"
import { BadRequest, Conflict, NotFound } from "@mosaik/core"
import { type CreateTarget, Target, type TargetKind, type UpdateTarget } from "@mosaik/notifications/contract"
import { Context, Effect, Layer, Option, Redacted, Schema } from "effect"
import { SqlSchema } from "effect/sql"
import { NotificationsConfig } from "../NotificationsConfig"

/** Where a target posts. Webhook URLs are secrets: they are never returned by the API. */
export type TargetConfig =
  | { readonly kind: "slack-webhook" | "teams-webhook"; readonly url: Redacted.Redacted<string> }
  | { readonly kind: "slack-channel"; readonly channel: string }

export interface StoredTarget {
  readonly id: string
  readonly name: string
  readonly config: TargetConfig
  readonly allowedSources: ReadonlyArray<string>
}

const TargetRow = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  kind: Schema.Literals(["slack-webhook", "slack-channel", "teams-webhook"]),
  config: Schema.Struct({ url: Schema.optional(Schema.String), channel: Schema.optional(Schema.String) }),
  allowedSources: Schema.Array(Schema.String),
  createdAt: Schema.DateTimeUtcFromDate,
})
type TargetRow = typeof TargetRow.Type

const toConfig = (row: TargetRow): TargetConfig =>
  row.kind === "slack-channel"
    ? { kind: row.kind, channel: row.config.channel ?? "" }
    : { kind: row.kind, url: Redacted.make(row.config.url ?? "") }

/** `hooks.slack.com/…/AbCd`: enough to tell webhooks apart without revealing them. */
export const maskUrl = (url: string): string => {
  try {
    const parsed = new URL(url)
    return `${parsed.host}/…${(parsed.pathname + parsed.search).slice(-4)}`
  } catch {
    return "…"
  }
}

const toPublic = (row: TargetRow) =>
  new Target({
    id: row.id,
    name: row.name,
    kind: row.kind,
    address: row.kind === "slack-channel" ? (row.config.channel ?? "") : maskUrl(row.config.url ?? ""),
    allowedSources: row.allowedSources,
    createdAt: row.createdAt,
  })

/** Admin-managed Teams and Slack channels that messages and notifications can be sent to. */
export class Targets extends Context.Service<
  Targets,
  {
    readonly list: Effect.Effect<ReadonlyArray<Target>>
    get(id: string): Effect.Effect<Option.Option<StoredTarget>>
    create(input: CreateTarget): Effect.Effect<Target, Conflict | BadRequest>
    update(id: string, input: UpdateTarget): Effect.Effect<Target, NotFound | BadRequest>
    delete(id: string): Effect.Effect<void, NotFound>
  }
>()("@mosaik/notifications-service/Targets") {
  static readonly layer = Layer.effect(
    Targets,
    Effect.gen(function* () {
      const sql = yield* PgClient.PgClient
      const config = yield* NotificationsConfig
      const columns = sql.literal("id, name, kind, config, allowed_sources, created_at")

      const findAll = SqlSchema.findAll({
        Request: Schema.Void,
        Result: TargetRow,
        execute: () => sql`SELECT ${columns} FROM targets ORDER BY name`,
      })
      const findById = SqlSchema.findOneOption({
        Request: Schema.String,
        Result: TargetRow,
        execute: (id) => sql`SELECT ${columns} FROM targets WHERE id = ${id}`,
      })

      /** The config a kind needs, from the request (or the existing target on update). */
      const configFor = (kind: TargetKind, url: string | undefined, channel: string | undefined) => {
        if (kind === "slack-channel") {
          if (Option.isNone(config.slack)) {
            return Effect.fail(new BadRequest({ message: "Slack channel targets need SLACK_BOT_TOKEN" }))
          }
          return channel === undefined
            ? Effect.fail(new BadRequest({ message: "A Slack channel is required" }))
            : Effect.succeed({ channel })
        }
        if (url === undefined) return Effect.fail(new BadRequest({ message: "A webhook URL is required" }))
        if (kind === "slack-webhook" && new URL(url).host !== "hooks.slack.com") {
          return Effect.fail(new BadRequest({ message: "Slack webhooks start with https://hooks.slack.com/" }))
        }
        return Effect.succeed({ url })
      }

      const get = (id: string) =>
        findById(id).pipe(Effect.orDie, Effect.map(Option.map((row) => ({ ...row, config: toConfig(row) }))))

      return Targets.of({
        list: findAll().pipe(
          Effect.map((rows) => rows.map(toPublic)),
          Effect.orDie,
        ),

        get,

        create: Effect.fn("Targets.create")(function* (input: CreateTarget) {
          const stored = yield* configFor(input.kind, input.url, input.channel)
          const rows = yield* sql`
            INSERT INTO targets ${sql.insert({
              id: input.id,
              name: input.name,
              kind: input.kind,
              config: sql.json(stored),
              allowedSources: sql.json([...new Set(input.allowedSources)]),
            })}
            ON CONFLICT (id) DO NOTHING
            RETURNING id
          `.pipe(Effect.orDie)
          if (rows.length === 0) return yield* new Conflict({ message: `Target "${input.id}" already exists` })
          const created = yield* findById(input.id).pipe(Effect.orDie)
          return toPublic(Option.getOrThrow(created))
        }),

        update: Effect.fn("Targets.update")(function* (id: string, input: UpdateTarget) {
          const existing = yield* findById(id).pipe(Effect.orDie)
          if (Option.isNone(existing)) return yield* new NotFound({ resource: "target", id })
          const row = existing.value
          const stored = yield* configFor(row.kind, input.url ?? row.config.url, input.channel ?? row.config.channel)
          yield* sql`
            UPDATE targets SET
              name = ${input.name ?? row.name},
              config = ${sql.json(stored)},
              allowed_sources = ${sql.json([...new Set(input.allowedSources ?? row.allowedSources)])},
              updated_at = now()
            WHERE id = ${id}
          `.pipe(Effect.orDie)
          const updated = yield* findById(id).pipe(Effect.orDie)
          return toPublic(Option.getOrThrow(updated))
        }),

        delete: Effect.fn("Targets.delete")(function* (id: string) {
          const rows = yield* sql`DELETE FROM targets WHERE id = ${id} RETURNING id`.pipe(Effect.orDie)
          if (rows.length === 0) return yield* new NotFound({ resource: "target", id })
        }),
      })
    }),
  )
}
