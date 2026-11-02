import { AssistantApi, AssistantStatus, Conversation, TurnEvent } from "@mosaik/assistant/contract"
import { CurrentPrincipal, NotFound } from "@mosaik/core"
import { Live } from "@mosaik/server"
import { Effect, Option, type Stream } from "effect"
import { HttpApiBuilder } from "effect/http-api"
import { AssistantConfig } from "../AssistantConfig"
import { Conversations } from "../Conversations"
import { Model } from "../Model"
import { pendingCalls, Turns } from "../Turns"

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
      conversation: Effect.fn(function* ({ params }) {
        const { user } = yield* currentUser
        const found = yield* conversations.find(user.id, params.id)
        if (Option.isNone(found)) return yield* new NotFound({ resource: "conversation", id: params.id })
        const { summary, messages } = found.value
        return new Conversation({ ...summary, messages, pending: pendingCalls(messages) })
      }),
      send: Effect.fn(function* ({ params, payload }) {
        const { principal } = yield* currentUser
        return yield* stream(yield* turns.send(principal, params.id, payload))
      }),
      decide: Effect.fn(function* ({ params, payload }) {
        const { principal } = yield* currentUser
        return yield* stream(yield* turns.decide(principal, params.id, payload.decisions))
      }),
    })
  }),
)
