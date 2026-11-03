import { PgClient } from "@effect/sql-pg"
import { BadRequest, type Principal, StatusAudience, StatusValue } from "@mosaik/core"
import {
  CORE_STATUS_OWNER,
  CoreStatuses,
  type CoreStatusName,
  PersonStatus,
  RUNNING_STATUS_TTL_SECONDS,
  type StatusDeclaration,
  type StatusEntry,
  StatusSnapshot,
} from "@mosaik/platform/contract"
import {
  Cache,
  Context,
  DateTime,
  Duration,
  Effect,
  Layer,
  Option,
  PubSub,
  Queue,
  Ref,
  Schedule,
  Schema,
  Stream,
} from "effect"
import { SqlSchema } from "effect/sql"
import { AccessRequests } from "./AccessRequests"
import { Apps } from "./Apps"

/** Postgres channel, notified with an owner (an app's id, or `core`) when its statuses change. */
const CHANNEL = "mosaik_statuses"

/** How often values past their time (work running that was not renewed) are removed. */
const SWEEP_EVERY = Duration.seconds(30)

// --- Stored values --------------------------------------------------------------------------

/** A status value as stored: whose, for whom, and until when (work running). */
export interface StoredStatus {
  readonly owner: string
  readonly name: string
  readonly audience: StatusAudience
  readonly value: StatusValue
  /** Where it leads: under the app's address for an app's; `null`: its page. */
  readonly link: string | null
  readonly expiresAt: DateTime.Utc | null
  readonly updatedAt: DateTime.Utc
}

/** How an audience is stored: `user:<id>` or `permission:<key>`. */
export const audienceKey = (audience: StatusAudience): string =>
  audience._tag === "user" ? `user:${audience.id}` : `permission:${audience.permission}`

const decodeAudience = Schema.decodeUnknownOption(StatusAudience)

/** The audience a stored key stands for (a permission's own `:` belongs to it: only the first one separates). */
export const audienceOf = (key: string): Option.Option<StatusAudience> => {
  const at = key.indexOf(":")
  const rest = key.slice(at + 1)
  switch (key.slice(0, at)) {
    case "user":
      return decodeAudience({ _tag: "user", id: rest })
    case "permission":
      return decodeAudience({ _tag: "permission", permission: rest })
    default:
      return Option.none()
  }
}

const Row = Schema.Struct({
  owner: Schema.String,
  name: Schema.String,
  audience: Schema.String,
  value: StatusValue,
  link: Schema.NullOr(Schema.String),
  expiresAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
  updatedAt: Schema.DateTimeUtcFromDate,
})

const rowId = (status: Pick<StoredStatus, "owner" | "name" | "audience">) =>
  `${status.owner}\u0000${status.name}\u0000${audienceKey(status.audience)}`

/** A count of nothing says nothing: it is not kept. */
const isEmpty = (value: StatusValue) => value._tag === "count" && value.count === 0

/**
 * The current values of every status, kept in memory and in Postgres: writes go to the table and
 * notify; every instance reloads the owner's values when notified, so reads cost nothing. Work
 * running expires unless set again, and is removed a little after it does.
 */
export class StatusStore extends Context.Service<
  StatusStore,
  {
    /** The values that have not expired. */
    readonly current: Effect.Effect<ReadonlyArray<StoredStatus>>
    /** Ticks once at once, then after each change is in `current`. */
    readonly changes: Stream.Stream<void>
    /** Writes values of a status; with `replace`, the values not given are cleared. */
    write(
      owner: string,
      name: string,
      entries: ReadonlyArray<StatusEntry>,
      options: { readonly replace: boolean },
    ): Effect.Effect<void>
    /** Clears an owner's statuses, but the ones named in `keep` (none: all of them). */
    prune(owner: string, keep: ReadonlyArray<string>): Effect.Effect<void>
  }
>()("@mosaik/platform-service/StatusStore") {
  static readonly layer = Layer.effect(
    StatusStore,
    Effect.gen(function* () {
      const sql = yield* PgClient.PgClient
      const rows = yield* Ref.make<ReadonlyMap<string, StoredStatus>>(new Map())
      const changed = yield* PubSub.sliding<void>(64)

      const findAll = SqlSchema.findAll({
        Request: Schema.NullOr(Schema.String),
        Result: Row,
        execute: (owner) =>
          owner === null
            ? sql`SELECT owner, name, audience, value, link, expires_at, updated_at FROM statuses`
            : sql`SELECT owner, name, audience, value, link, expires_at, updated_at FROM statuses WHERE owner = ${owner}`,
      })

      /** Reads an owner's values again (every owner's: `null`), replacing the ones in memory. */
      const reload = Effect.fn(function* (owner: string | null) {
        const loaded = yield* findAll(owner).pipe(Effect.orDie)
        const statuses = loaded.flatMap((row) =>
          Option.match(audienceOf(row.audience), {
            onNone: () => [],
            onSome: (audience): ReadonlyArray<StoredStatus> => [{ ...row, audience }],
          }),
        )
        yield* Ref.update(rows, (current) => {
          const next = new Map([...current].filter(([, status]) => owner !== null && status.owner !== owner))
          for (const status of statuses) next.set(rowId(status), status)
          return next
        })
        yield* PubSub.publish(changed, undefined)
      })

      yield* reload(null)
      yield* Effect.gen(function* () {
        const notifications = yield* sql.listen(CHANNEL)
        // Reconnecting may have missed changes: read everything again first.
        yield* reload(null)
        while (true) yield* reload((yield* Queue.take(notifications)).payload)
      }).pipe(
        Effect.scoped,
        Effect.tapCause((cause) => Effect.logWarning("Status listener stopped, reconnecting", cause)),
        Effect.retry(Schedule.spaced("5 seconds")),
        Effect.forkScoped,
      )

      // Running work that was not set again in time is over (its app stopped, or crashed).
      yield* sql<{ owner: string }>`DELETE FROM statuses WHERE expires_at <= now() RETURNING owner`.pipe(
        Effect.flatMap((expired) =>
          Effect.forEach(
            new Set(expired.map((row) => row.owner)),
            (owner) => sql`SELECT pg_notify(${CHANNEL}, ${owner})`,
          ),
        ),
        Effect.catchCause((cause) => Effect.logWarning("Could not remove expired statuses", cause)),
        Effect.repeat(Schedule.spaced(SWEEP_EVERY)),
        Effect.forkScoped,
      )

      const encodeValue = Schema.encodeSync(StatusValue)

      return StatusStore.of({
        current: Effect.gen(function* () {
          const now = yield* DateTime.now
          const all = yield* Ref.get(rows)
          return [...all.values()].filter(
            (status) => status.expiresAt === null || DateTime.isGreaterThan(status.expiresAt, now),
          )
        }),

        changes: Stream.unwrap(
          // Subscribed before the first tick, so a change right after it is not missed.
          Effect.map(PubSub.subscribe(changed), (subscription) =>
            Stream.concat(Stream.make(undefined), Stream.fromSubscription(subscription)),
          ),
        ),

        write: Effect.fn("StatusStore.write")(function* (owner, name, entries, { replace }) {
          yield* sql
            .withTransaction(
              Effect.gen(function* () {
                if (replace) yield* sql`DELETE FROM statuses WHERE owner = ${owner} AND name = ${name}`
                for (const { audience, value, link } of entries) {
                  const key = audienceKey(audience)
                  if (value === null || isEmpty(value)) {
                    yield* sql`DELETE FROM statuses WHERE owner = ${owner} AND name = ${name} AND audience = ${key}`
                    continue
                  }
                  const expiresAt =
                    value._tag === "running"
                      ? sql`now() + make_interval(secs => ${RUNNING_STATUS_TTL_SECONDS})`
                      : sql`NULL`
                  yield* sql`
                    INSERT INTO statuses (owner, name, audience, value, link, expires_at)
                    VALUES (${owner}, ${name}, ${key}, ${sql.json(encodeValue(value))}, ${link}, ${expiresAt})
                    ON CONFLICT (owner, name, audience) DO UPDATE SET
                      value = EXCLUDED.value, link = EXCLUDED.link, expires_at = EXCLUDED.expires_at, updated_at = now()
                  `
                }
                // Delivered on commit: readers see all of the change, or none of it.
                yield* sql`SELECT pg_notify(${CHANNEL}, ${owner})`
              }),
            )
            .pipe(Effect.orDie)
        }),

        prune: Effect.fn("StatusStore.prune")(function* (owner, keep) {
          yield* sql
            .withTransaction(
              Effect.gen(function* () {
                yield* keep.length === 0
                  ? sql`DELETE FROM statuses WHERE owner = ${owner}`
                  : sql`DELETE FROM statuses WHERE owner = ${owner} AND name NOT IN ${sql.in(keep)}`
                yield* sql`SELECT pg_notify(${CHANNEL}, ${owner})`
              }),
            )
            .pipe(Effect.orDie)
        }),
      })
    }),
  )
}

// --- What people see ------------------------------------------------------------------------

/** What the platform knows of an app's statuses: who may open it, and what it declared. */
export interface AppStatuses {
  readonly access: string
  readonly declarations: ReadonlyMap<string, StatusDeclaration>
}

/** Whether the person is in the audience. */
export const reaches = (principal: Principal, audience: StatusAudience): boolean =>
  audience._tag === "user" ? principal.user?.id === audience.id : principal.can(audience.permission)

/**
 * A stored value as its person sees it, with what its declaration says. `None` when the person
 * may not see it, or when it is no longer declared (the app changed since it was set).
 */
export const toPersonStatus = (
  principal: Principal,
  status: StoredStatus,
  app: Option.Option<AppStatuses>,
): Option.Option<PersonStatus> => {
  if (!reaches(principal, status.audience)) return Option.none()
  const base = { key: `${status.owner}:${status.name}`, value: status.value, updatedAt: status.updatedAt }
  if (status.owner === CORE_STATUS_OWNER) {
    const core = CoreStatuses[status.name as CoreStatusName] as (typeof CoreStatuses)[CoreStatusName] | undefined
    if (core === undefined) return Option.none()
    return Option.some(
      new PersonStatus({
        ...base,
        app: null,
        description: core.description,
        kind: core.kind,
        tone: "attention",
        path: core.path,
        link: status.link ?? core.path,
      }),
    )
  }
  if (Option.isNone(app) || !principal.can(app.value.access)) return Option.none()
  const declaration = app.value.declarations.get(status.name)
  if (declaration === undefined) return Option.none()
  return Option.some(
    new PersonStatus({
      ...base,
      app: status.owner,
      description: declaration.description,
      kind: declaration.kind,
      // Trouble says how bad it is.
      tone: status.value._tag === "health" ? status.value.level : declaration.tone,
      path: `/${status.owner}${declaration.page ?? ""}`,
      // An app links under its own address only.
      link: `/${status.owner}${status.link ?? declaration.page ?? ""}`,
    }),
  )
}

/** In the order navigation reads them: by where they show, then by key. */
export const byPlace = (a: PersonStatus, b: PersonStatus) => a.path.localeCompare(b.path) || a.key.localeCompare(b.key)

/** Why an app's entry does not fit its declaration, if it does not. */
export const entryProblem = (app: string, declaration: StatusDeclaration | undefined, entry: StatusEntry) => {
  if (declaration === undefined) return "The status is not in the app's manifest"
  if (entry.value !== null && entry.value._tag !== declaration.kind) {
    return `"${declaration.name}" is a ${declaration.kind} status, not ${entry.value._tag}`
  }
  if (entry.audience._tag === "permission" && !entry.audience.permission.startsWith(`${app}:`)) {
    return `Statuses go to the app's own permissions, not "${entry.audience.permission}"`
  }
  return undefined
}

const encodeStatuses = Schema.encodeSync(Schema.Array(PersonStatus))
const sameStatuses = (a: ReadonlyArray<PersonStatus>, b: ReadonlyArray<PersonStatus>) =>
  JSON.stringify(encodeStatuses(a)) === JSON.stringify(encodeStatuses(b))

/**
 * Statuses as people see them: apps' values checked against their manifests, each person's
 * filtered by their grants, with Core's own (requests for access, computed here; the assistant's,
 * set by the assistant).
 */
export class Statuses extends Context.Service<
  Statuses,
  {
    /** An app's values (`replace`: all of a status's at once). */
    set(
      app: string,
      name: string,
      entries: ReadonlyArray<StatusEntry>,
      options: { readonly replace: boolean },
    ): Effect.Effect<void, BadRequest>
    /** One of Core's own, set by a Core service. */
    setCore(name: CoreStatusName, entry: StatusEntry): Effect.Effect<void, BadRequest>
    /** The app registered a manifest (`null`: it was removed): values it no longer declares go. */
    declared(app: string, declarations: ReadonlyArray<StatusDeclaration> | null): Effect.Effect<void>
    /** What the person may see now. */
    forPrincipal(principal: Principal): Effect.Effect<ReadonlyArray<PersonStatus>>
    /** What the person may see, now and after each change to it. */
    live(principal: Principal): Stream.Stream<StatusSnapshot>
  }
>()("@mosaik/platform-service/Statuses") {
  static readonly layer = Layer.effect(
    Statuses,
    Effect.gen(function* () {
      const store = yield* StatusStore
      const apps = yield* Apps
      const requests = yield* AccessRequests

      // Read for every change of every person's statuses: kept a while, dropped when the app registers.
      const appStatuses = yield* Cache.makeWith(
        (app: string) =>
          Effect.map(apps.get(app), (record) =>
            Option.flatMapNullishOr(record, (found) => found.manifest).pipe(
              Option.map(
                (manifest): AppStatuses => ({
                  access: manifest.access,
                  declarations: new Map(manifest.statuses.map((declaration) => [declaration.name, declaration])),
                }),
              ),
            ),
          ),
        { capacity: 1024, timeToLive: () => Duration.minutes(5) },
      )

      const stored = Effect.fn(function* (principal: Principal) {
        const values = yield* store.current
        const owners = new Set(values.map((status) => status.owner).filter((owner) => owner !== CORE_STATUS_OWNER))
        const known = new Map(
          yield* Effect.forEach(owners, (owner) =>
            Effect.map(Cache.get(appStatuses, owner), (app) => [owner, app] as const),
          ),
        )
        return values.flatMap((status) =>
          Option.toArray(toPersonStatus(principal, status, known.get(status.owner) ?? Option.none())),
        )
      })

      /** Requests for access waiting for the person: computed, they are never stored. */
      const accessRequests = Effect.fn(function* (principal: Principal) {
        if (principal.user === null) return []
        // Newest first.
        const [newest, ...older] = yield* requests.list(principal, { status: "pending" })
        if (newest === undefined) return []
        const core = CoreStatuses["access.requests"]
        return [
          new PersonStatus({
            key: `${CORE_STATUS_OWNER}:access.requests`,
            app: null,
            description: core.description,
            kind: core.kind,
            tone: "attention",
            path: core.path,
            link: core.path,
            value: { _tag: "count", count: older.length + 1 },
            updatedAt: newest.createdAt,
          }),
        ]
      })

      return Statuses.of({
        set: Effect.fn("Statuses.set")(function* (app, name, entries, options) {
          const declaration = Option.flatMap(yield* Cache.get(appStatuses, app), (known) =>
            Option.fromUndefinedOr(known.declarations.get(name)),
          )
          for (const entry of entries) {
            const problem = entryProblem(app, Option.getOrUndefined(declaration), entry)
            if (problem !== undefined) return yield* new BadRequest({ message: problem })
          }
          yield* store.write(app, name, entries, options)
        }),

        setCore: Effect.fn("Statuses.setCore")(function* (name, entry) {
          if (entry.value !== null && entry.value._tag !== CoreStatuses[name].kind) {
            return yield* new BadRequest({ message: `"${name}" is a ${CoreStatuses[name].kind} status` })
          }
          yield* store.write(CORE_STATUS_OWNER, name, [entry], { replace: false })
        }),

        declared: Effect.fn("Statuses.declared")(function* (app, declarations) {
          yield* Cache.invalidate(appStatuses, app)
          yield* store.prune(
            app,
            (declarations ?? []).map((declaration) => declaration.name),
          )
        }),

        forPrincipal: Effect.fn("Statuses.forPrincipal")(function* (principal) {
          return [...(yield* stored(principal)), ...(yield* accessRequests(principal))].toSorted(byPlace)
        }),

        live: (principal) => {
          // Each part is read again only when it may have changed.
          const storedPart = store.changes.pipe(
            Stream.debounce("100 millis"),
            Stream.mapEffect(() => stored(principal)),
          )
          const requestsPart = requests.changes.pipe(Stream.mapEffect(() => accessRequests(principal)))
          return Stream.zipLatest(storedPart, requestsPart).pipe(
            Stream.map(([values, computed]) => [...values, ...computed].toSorted(byPlace)),
            Stream.changesWith(sameStatuses),
            Stream.map((statuses) => new StatusSnapshot({ statuses })),
          )
        },
      })
    }),
  )
}
