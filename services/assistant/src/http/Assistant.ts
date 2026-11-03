import { AssistantApi, AssistantStatus, Conversation, TurnEvent } from "@mosaik/assistant/contract"
import { Conflict, CurrentPrincipal, NotFound } from "@mosaik/core"
import { Live } from "@mosaik/server"
import { Catalog } from "@mosaik/tools"
import { Effect, Option, type Stream } from "effect"
import { HttpApiBuilder } from "effect/http-api"
import { AssistantConfig } from "../AssistantConfig"
import { pendingCalls } from "../Calls"
import { Conversations } from "../Conversations"
import { Model } from "../Model"
import { suggestionsFrom } from "../Suggestions"
import { Turns } from "../Turns"

/** The signed-in person (the API's access control lets nobody else in). */
const currentUser = Effect.gen(function* () {
  const principal = yield* CurrentPrincipal
  if (principal.user === null) return yield* Effect.die("AccessControlUsers lets only signed-in people in")
  return { principal, user: principal.user }
})

/** A turn's events, as Server-Sent Events while it runs. */
const stream = (events: Stream.Stream<TurnEvent>) => Live.eventStream(TurnEvent, events)

export const AssistantHandlers = HttpApiBuilder.group(
  AssistantApi,
  "assistant",
  Effect.fn(function* (handlers) {
    const config = yield* AssistantConfig
    const model = yield* Model
    const conversations = yield* Conversations
    const turns = yield* Turns
    const catalog = yield* Catalog
    const notFound = (id: string) => new NotFound({ resource: "conversation", id })

    return handlers.handleAll({
      status: () =>
        Effect.succeed(
          new AssistantStatus({
            enabled: Option.isSome(config.model),
            model: Option.isSome(config.model) ? model.label : null,
          }),
        ),
      conversations: () => Effect.flatMap(currentUser, ({ user }) => conversations.list(user.id)),
      start: () => Effect.flatMap(currentUser, ({ user }) => conversations.start(user.id)),
      suggestions: Effect.fn(function* () {
        const { principal } = yield* currentUser
        return suggestionsFrom(yield* catalog.visibleTo(principal))
      }),
      rename: Effect.fn(function* ({ params, payload }) {
        const { user } = yield* currentUser
        const renamed = yield* conversations.rename(user.id, params.id, payload.title)
        if (Option.isNone(renamed)) return yield* notFound(params.id)
        return renamed.value
      }),
      remove: Effect.fn(function* ({ params }) {
        const { user } = yield* currentUser
        if (turns.busy(params.id)) return yield* new Conflict({ message: "The assistant is still answering" })
        if (!(yield* conversations.remove(user.id, params.id))) return yield* notFound(params.id)
      }),
      conversation: Effect.fn(function* ({ params }) {
        const { user } = yield* currentUser
        const found = yield* conversations.find(user.id, params.id)
        if (Option.isNone(found)) return yield* notFound(params.id)
        const { summary, messages } = found.value
        return new Conversation({ ...summary, messages, pending: pendingCalls(messages) })
      }),
      send: Effect.fn(function* ({ params, payload }) {
        const { principal } = yield* currentUser
        return yield* stream(yield* turns.send(principal, params.id, payload))
      }),
      resolve: Effect.fn(function* ({ params, payload }) {
        const { principal } = yield* currentUser
        return yield* stream(yield* turns.resolve(principal, params.id, payload.resolutions))
      }),
    })
  }),
)
