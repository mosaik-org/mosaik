import { BadRequest, Conflict, CurrentPrincipal, type StoredObject, storageKeyProblem } from "@mosaik/sdk"
import { Audit, Live, Storage } from "@mosaik/sdk/server"
import { Effect, Layer, Stream } from "effect"
import { HttpApiBuilder } from "effect/http-api"
import { ATTACHMENT_TYPES, Attachment, DeskApi, type RequestId, RequestsChanged, requestNumber } from "../api"
import { Changes } from "./Changes"
import { Desk } from "./Desk"
import { People } from "./People"
import { Requests } from "./Requests"
import { Setup } from "./Setup"

/** Where a request's attachments are kept in the desk's storage. */
const folder = (id: RequestId) => `requests/${id}/`

/** What cannot be in an attachment's name: control characters and path separators. */
// biome-ignore lint/suspicious/noControlCharactersInRegex: control characters are what it replaces
const UNSAFE_IN_NAMES = /[\u0000-\u001f\u007f/\\]/g

/** A file's name as an attachment: one path segment, no control characters, at most 200 characters. */
const attachmentName = (name: string) => {
  const cleaned = name.replace(UNSAFE_IN_NAMES, "_").trim().slice(-200)
  return storageKeyProblem(cleaned) === undefined ? cleaned : "file"
}

const toAttachment = (id: RequestId, object: StoredObject) =>
  new Attachment({
    name: object.key.slice(folder(id).length),
    size: object.size,
    contentType: object.contentType,
    uploadedAt: object.updatedAt,
  })

const RequestsHandlers = HttpApiBuilder.group(
  DeskApi,
  "requests",
  Effect.fn(function* (handlers) {
    const desk = yield* Desk
    const changes = yield* Changes
    const storage = yield* Storage
    const audit = yield* Audit

    /** Runs what needs to know who is asking. */
    const asCaller = <A, E, R>(use: (principal: typeof CurrentPrincipal.Service) => Effect.Effect<A, E, R>) =>
      Effect.flatMap(CurrentPrincipal, use)

    return handlers.handleAll({
      list: ({ query }) => asCaller((principal) => desk.list(principal, query)),
      get: ({ params }) => asCaller((principal) => desk.get(principal, params.id)),
      create: ({ payload }) => asCaller((principal) => desk.create(principal, payload)),
      edit: ({ payload }) => asCaller((principal) => desk.edit(principal, payload)),
      remove: ({ params }) =>
        asCaller((principal) =>
          Effect.gen(function* () {
            yield* desk.remove(principal, params.id)
            // Its files go with it. Failing to remove them leaves files nobody reaches, and the request gone.
            const stored = yield* storage.list({ prefix: folder(params.id), limit: 1000 })
            yield* Effect.forEach(stored.objects, (object) => storage.delete(object.key))
          }).pipe(
            Effect.catchTag("StorageUnavailable", (error) => Effect.logWarning("Could not remove its files", error)),
          ),
        ),
      activity: ({ params }) => asCaller((principal) => desk.activity(principal, params.id)),
      reply: ({ params, payload }) => asCaller((principal) => desk.reply(principal, params.id, payload)),
      markRead: ({ params }) => asCaller((principal) => desk.markRead(principal, params.id)),

      live: () =>
        Live.eventStream(RequestsChanged, changes.stream.pipe(Stream.map((ids) => new RequestsChanged({ ids })))),

      attachments: ({ params }) =>
        asCaller((principal) =>
          Effect.gen(function* () {
            yield* desk.visible(principal, params.id)
            const page = yield* storage.list({ prefix: folder(params.id), limit: 1000 })
            return page.objects.map((object) => toAttachment(params.id, object))
          }),
        ),

      // The desk decides what it takes: the platform stores any file, and only counts.
      attach: ({ params, payload: { file } }) =>
        asCaller((principal) =>
          Effect.gen(function* () {
            yield* desk.visible(principal, params.id)
            if (!(ATTACHMENT_TYPES as ReadonlyArray<string>).includes(file.contentType)) {
              return yield* new BadRequest({ message: "Attach a PDF, an image or a text file" })
            }
            const name = attachmentName(file.name)
            const stored = yield* storage.put(`${folder(params.id)}${name}`, file)
            yield* audit.record({ action: "requests.attach", target: requestNumber(params.id), details: { name } })
            return toAttachment(params.id, stored)
          }),
        ),

      // Served by the SDK: a download, or an image or PDF shown in place, never run as the desk's page.
      attachment: ({ params, query }) =>
        asCaller((principal) =>
          Effect.andThen(
            desk.visible(principal, params.id),
            storage.respond(`${folder(params.id)}${params.name}`, {
              inline: query.inline === "true",
              filename: params.name,
            }),
          ),
        ),

      detach: ({ params }) =>
        Effect.gen(function* () {
          const key = `${folder(params.id)}${params.name}`
          yield* storage.head(key)
          yield* storage.delete(key)
          yield* audit.record({
            action: "requests.detach",
            target: requestNumber(params.id),
            details: { name: params.name },
          })
        }),
    })
  }),
)

const DirectoryHandlers = HttpApiBuilder.group(
  DeskApi,
  "directory",
  Effect.fn(function* (handlers) {
    const setup = yield* Setup
    const people = yield* People
    return handlers.handleAll({
      queues: () => setup.queues,
      agents: () => people.agents,
      deadlines: () => setup.deadlines,
      savedReplies: () => setup.savedReplies,
    })
  }),
)

const SetupHandlers = HttpApiBuilder.group(
  DeskApi,
  "setup",
  Effect.fn(function* (handlers) {
    const setup = yield* Setup
    const requests = yield* Requests
    const audit = yield* Audit
    const audited =
      (action: string, target: string) =>
      <A, E, R>(write: Effect.Effect<A, E, R>) =>
        Effect.tap(write, () => audit.record({ action: `setup.${action}`, target }))

    return handlers.handleAll({
      createQueue: ({ payload }) => setup.createQueue(payload).pipe(audited("create-queue", payload.name)),
      updateQueue: ({ params, payload }) =>
        setup.updateQueue(params.id, payload).pipe(audited("update-queue", payload.name)),
      removeQueue: ({ params }) =>
        Effect.gen(function* () {
          const inIt = yield* requests.count({ queueId: params.id })
          if (inIt > 0) {
            return yield* new Conflict({
              message: `${inIt} ${inIt === 1 ? "request is" : "requests are"} in this queue. Move them first.`,
            })
          }
          yield* setup.removeQueue(params.id)
          yield* audit.record({ action: "setup.remove-queue", target: String(params.id) })
        }),
      setDeadline: ({ payload }) => setup.setDeadline(payload).pipe(audited("set-deadline", payload.priority)),
      createSavedReply: ({ payload }) =>
        setup.createSavedReply(payload).pipe(audited("create-saved-reply", payload.title)),
      updateSavedReply: ({ params, payload }) =>
        setup.updateSavedReply(params.id, payload).pipe(audited("update-saved-reply", payload.title)),
      removeSavedReply: ({ params }) =>
        setup.removeSavedReply(params.id).pipe(audited("remove-saved-reply", String(params.id))),
    })
  }),
)

/** The API's handlers, for any stores: Postgres in production, in memory in tests. */
export const ApiHandlers = Layer.mergeAll(RequestsHandlers, DirectoryHandlers, SetupHandlers)
