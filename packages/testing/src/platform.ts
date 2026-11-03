import { readFile } from "node:fs/promises"
import {
  type App,
  BadRequest,
  CurrentPrincipal,
  NotFound,
  type PlatformEventType,
  type PrincipalUser,
  type SettingsSpec,
  type SettingValue,
  type StatusAudience,
  type StatusValue,
} from "@mosaik/core"
import { MessageAccepted, NotificationAccepted } from "@mosaik/notifications/contract"
import {
  AppEvent,
  type StatusEntry,
  StorageLimitReached,
  StoredObject,
  StoredObjectsPage,
  storageKeyProblem,
} from "@mosaik/platform/contract"
import {
  Audit,
  type AuditEntry,
  EventHandlers,
  fileResponse,
  Messages,
  Notify,
  type SendMessage,
  type SendNotification,
  Settings,
  Status,
  Storage,
  type StorageData,
} from "@mosaik/server"
import { Context, DateTime, Effect, Layer, Option, Ref, type Schema, SubscriptionRef } from "effect"

/** An audit entry as the app recorded it, with who it was recorded for. */
export interface RecordedAudit extends AuditEntry {
  readonly actor: PrincipalUser | null
}

/** What the app recorded in the audit log, in order. */
export class TestAudit extends Context.Service<
  TestAudit,
  { readonly entries: Effect.Effect<ReadonlyArray<RecordedAudit>> }
>()("@mosaik/testing/TestAudit") {
  /** `Audit` for the app, recording here. */
  static readonly layer = Layer.unwrap(
    Effect.gen(function* () {
      const entries = yield* Ref.make<ReadonlyArray<RecordedAudit>>([])
      return Layer.mergeAll(
        Layer.succeed(
          Audit,
          Audit.of({
            record: (entry) =>
              Effect.gen(function* () {
                const principal = yield* Effect.serviceOption(CurrentPrincipal)
                const actor = Option.match(principal, { onNone: () => null, onSome: (p) => p.user })
                yield* Ref.update(entries, (all) => [...all, { ...entry, actor }])
              }),
          }),
        ),
        Layer.succeed(TestAudit, TestAudit.of({ entries: Ref.get(entries) })),
      )
    }),
  )
}

/** The notifications the app sent, in order (nobody receives them). */
export class TestNotify extends Context.Service<
  TestNotify,
  { readonly sent: Effect.Effect<ReadonlyArray<SendNotification>> }
>()("@mosaik/testing/TestNotify") {
  static readonly layer = Layer.unwrap(
    Effect.gen(function* () {
      const sent = yield* Ref.make<ReadonlyArray<SendNotification>>([])
      return Layer.mergeAll(
        Layer.succeed(
          Notify,
          Notify.of({
            send: (notification) =>
              Ref.modify(sent, (all) => [
                new NotificationAccepted({ id: all.length + 1, recipients: 0, deliveries: 0, duplicate: false }),
                [...all, notification],
              ]),
          }),
        ),
        Layer.succeed(TestNotify, TestNotify.of({ sent: Ref.get(sent) })),
      )
    }),
  )
}

/** How the test kit tells audiences apart, as the platform stores them. */
const audienceId = (audience: StatusAudience) =>
  audience._tag === "user" ? `user:${audience.id}` : `permission:${audience.permission}`

/**
 * The app's statuses as people would see them now: what was set, replaced and cleared applied as
 * the platform does (a count of nothing clears). Nothing is checked against the manifest.
 */
export class TestStatus extends Context.Service<
  TestStatus,
  {
    /** The status's current values, by audience. */
    values(name: string): Effect.Effect<ReadonlyArray<StatusEntry & { readonly value: StatusValue }>>
  }
>()("@mosaik/testing/TestStatus") {
  static readonly layer = Layer.unwrap(
    Effect.gen(function* () {
      const current = yield* Ref.make<ReadonlyMap<string, ReadonlyMap<string, StatusEntry>>>(new Map())
      return Layer.mergeAll(
        Layer.succeed(
          Status,
          Status.of({
            write: (name, entries, replace) =>
              Ref.update(current, (all) => {
                const values = new Map(replace ? [] : (all.get(name) ?? []))
                for (const entry of entries) {
                  const empty = entry.value === null || (entry.value._tag === "count" && entry.value.count === 0)
                  if (empty) values.delete(audienceId(entry.audience))
                  else values.set(audienceId(entry.audience), entry)
                }
                return new Map([...all, [name, values]])
              }),
          }),
        ),
        Layer.succeed(
          TestStatus,
          TestStatus.of({
            values: (name) =>
              Effect.map(Ref.get(current), (all) =>
                [...(all.get(name)?.values() ?? [])].flatMap((entry) =>
                  entry.value === null ? [] : [{ ...entry, value: entry.value }],
                ),
              ),
          }),
        ),
      )
    }),
  )
}

/** The messages the app sent, in order (nobody receives them). */
export class TestMessages extends Context.Service<
  TestMessages,
  { readonly sent: Effect.Effect<ReadonlyArray<SendMessage>> }
>()("@mosaik/testing/TestMessages") {
  static readonly layer = Layer.unwrap(
    Effect.gen(function* () {
      const sent = yield* Ref.make<ReadonlyArray<SendMessage>>([])
      return Layer.mergeAll(
        Layer.succeed(
          Messages,
          Messages.of({
            send: (message) =>
              Ref.modify(sent, (all) => [
                new MessageAccepted({ id: all.length + 1, deliveries: message.to.length, duplicate: false }),
                [...all, message],
              ]),
          }),
        ),
        Layer.succeed(TestMessages, TestMessages.of({ sent: Ref.get(sent) })),
      )
    }),
  )
}

type SettingsOf<D> = D extends App<string, string, string, PlatformEventType, infer S> ? S : never

/** Setting an app's settings, typed by its manifest. */
export interface TypedTestSettings<S extends SettingsSpec> {
  set<K extends keyof S & string>(name: K, value: SettingValue<S[K]>): Effect.Effect<void>
}

/**
 * The app's settings as its owners would change them: the defaults until a test sets one, which the
 * app reads at once, as it would a change in the console.
 */
export class TestSettings extends Context.Service<
  TestSettings,
  {
    /** Sets values by name (unchecked: `TestSettings.for(app)` is the typed way). */
    set(values: Readonly<Record<string, unknown>>): Effect.Effect<void>
    /** Back to every default. */
    readonly reset: Effect.Effect<void>
  }
>()("@mosaik/testing/TestSettings") {
  static readonly layer = Layer.unwrap(
    Effect.gen(function* () {
      const stored = yield* SubscriptionRef.make<Readonly<Record<string, Schema.Json>>>({})
      return Layer.mergeAll(
        Layer.succeed(Settings, Settings.of({ stored })),
        Layer.succeed(
          TestSettings,
          TestSettings.of({
            set: (values) =>
              SubscriptionRef.update(stored, (current) => ({ ...current, ...(values as Record<string, Schema.Json>) })),
            reset: SubscriptionRef.set(stored, {}),
          }),
        ),
      )
    }),
  )

  /** Setting the app's settings, typed by its manifest: `yield* (yield* TestSettings.for(sales)).set("refundLimit", 100)`. */
  static readonly for = <D extends App<string, string, string, PlatformEventType, SettingsSpec>>(
    _app: D,
  ): Effect.Effect<TypedTestSettings<SettingsOf<D>>, never, TestSettings> =>
    Effect.gen(function* () {
      const settings = yield* TestSettings
      return { set: (name, value) => settings.set({ [name]: value }) }
    })
}

/** A file the app stored: what the platform knows of it, and its bytes. */
export interface TestFile {
  readonly object: StoredObject
  readonly bytes: Uint8Array
}

const bytesOf = async (data: StorageData): Promise<Uint8Array> => {
  if (typeof data === "string") return new TextEncoder().encode(data)
  if (data instanceof Uint8Array) return data
  if (data instanceof Blob || data instanceof ReadableStream)
    return new Uint8Array(await new Response(data).arrayBuffer())
  return new Uint8Array(await readFile(data.path))
}

const typeOf = (data: StorageData) =>
  data instanceof Blob ? data.type : typeof data === "object" && "contentType" in data ? data.contentType : ""

/** The app's files, kept in memory: what it stored, and a limit to test running out of room. */
export class TestStorage extends Context.Service<
  TestStorage,
  {
    /** By key. */
    readonly files: Effect.Effect<ReadonlyMap<string, TestFile>>
    /** What the app may store in all, in bytes (none by default). */
    setLimit(bytes: number | null): Effect.Effect<void>
  }
>()("@mosaik/testing/TestStorage") {
  static readonly layer = Layer.unwrap(
    Effect.gen(function* () {
      const files = yield* Ref.make<ReadonlyMap<string, TestFile>>(new Map())
      const limit = yield* Ref.make<number | null>(null)
      const find = (key: string) =>
        Effect.flatMap(Ref.get(files), (all) => {
          const file = all.get(key)
          return file === undefined ? Effect.fail(new NotFound({ resource: "file", id: key })) : Effect.succeed(file)
        })
      const stream = (bytes: Uint8Array) => new Response(bytes.slice()).body as ReadableStream<Uint8Array>

      return Layer.mergeAll(
        Layer.succeed(
          Storage,
          Storage.of({
            put: (key, data, options) =>
              Effect.gen(function* () {
                const problem = storageKeyProblem(key)
                if (problem !== undefined) return yield* new BadRequest({ message: `Invalid key: ${problem}` })
                const bytes = yield* Effect.promise(() => bytesOf(data))
                const all = yield* Ref.get(files)
                const used = [...all.values()].reduce((sum, file) => sum + file.object.size, 0)
                const max = yield* Ref.get(limit)
                if (max !== null && used - (all.get(key)?.object.size ?? 0) + bytes.byteLength > max) {
                  return yield* new StorageLimitReached({ limitBytes: max, usedBytes: used })
                }
                const contentType = options?.contentType ?? (typeOf(data) || "application/octet-stream")
                const object = new StoredObject({
                  key,
                  size: bytes.byteLength,
                  contentType,
                  updatedAt: yield* DateTime.now,
                })
                yield* Ref.update(files, (current) => new Map(current).set(key, { object, bytes }))
                return object
              }),
            get: (key) => Effect.map(find(key), (file) => ({ object: file.object, body: stream(file.bytes) })),
            head: (key) => Effect.map(find(key), (file) => file.object),
            delete: (key) =>
              Ref.update(files, (current) => {
                const next = new Map(current)
                next.delete(key)
                return next
              }),
            list: (options = {}) =>
              Effect.map(Ref.get(files), (all) => {
                const keys = [...all.keys()]
                  .filter((key) => key.startsWith(options.prefix ?? "") && key > (options.after ?? ""))
                  .sort()
                const limit = options.limit ?? 100
                const objects = keys.slice(0, limit).map((key) => (all.get(key) as TestFile).object)
                return new StoredObjectsPage({
                  objects,
                  next: keys.length > limit ? (objects.at(-1)?.key ?? null) : null,
                })
              }),
            respond: (key, options) =>
              Effect.map(find(key), (file) => fileResponse({ object: file.object, body: stream(file.bytes) }, options)),
          }),
        ),
        Layer.succeed(
          TestStorage,
          TestStorage.of({ files: Ref.get(files), setLimit: (bytes) => Ref.set(limit, bytes) }),
        ),
      )
    }),
  )
}

/** Platform events handed to the app's handlers (`events` in its manifest, `Events.handlers`) on demand. */
export class TestEvents extends Context.Service<
  TestEvents,
  { deliver(type: PlatformEventType, data: Schema.Json): Effect.Effect<void, unknown> }
>()("@mosaik/testing/TestEvents") {
  static readonly layer = Layer.effect(
    TestEvents,
    Effect.gen(function* () {
      const handlers = yield* EventHandlers
      const position = yield* Ref.make(0)
      return TestEvents.of({
        deliver: (type, data) =>
          Effect.gen(function* () {
            const next = yield* Ref.updateAndGet(position, (n) => n + 1)
            yield* handlers.handle(
              new AppEvent({ id: crypto.randomUUID(), position: next, type, occurredAt: yield* DateTime.now, data }),
            )
          }),
      })
    }),
  )
}
