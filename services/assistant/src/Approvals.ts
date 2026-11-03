import type { UserId } from "@mosaik/core"
import { PlatformInternalClient } from "@mosaik/platform/server"
import { Context, Effect, Layer, Option } from "effect"
import { pendingCalls } from "./Calls"
import { Conversations } from "./Conversations"

/**
 * What the assistant waits for each person to allow, told to Core as the `assistant.approvals`
 * status: the shell shows it beside the assistant, wherever the person is, and keeps it live.
 */
export class Approvals extends Context.Service<
  Approvals,
  {
    /** After a turn of the conversation ended: counts what it waits for, then what the person does. */
    readonly settle: (user: UserId, conversation: string) => Effect.Effect<void>
    /** Counts again what waits for the person (a conversation was deleted). */
    readonly recount: (user: UserId) => Effect.Effect<void>
  }
>()("@mosaik/assistant-service/Approvals") {
  static readonly layer = Layer.effect(
    Approvals,
    Effect.gen(function* () {
      const conversations = yield* Conversations
      const platform = yield* PlatformInternalClient

      const recount = Effect.fn("Approvals.recount")(function* (user: UserId) {
        const waiting = yield* conversations.waitingIn(user)
        const changes = waiting.reduce((sum, conversation) => sum + conversation.changes, 0)
        // To the conversation when one waits; else the assistant's page, where the waiting ones are marked.
        const [only, ...others] = waiting
        const link = only !== undefined && others.length === 0 ? `/assistant/${only.id}` : "/assistant"
        yield* platform.statuses
          .setCore({
            params: { name: "assistant.approvals" },
            payload: { audience: { _tag: "user", id: user }, value: { _tag: "count", count: changes }, link },
          })
          .pipe(
            // A status that lags is no reason to fail what the person did.
            Effect.catchCause((cause) => Effect.logWarning("Could not tell Core what waits for approval", cause)),
          )
      })

      return Approvals.of({
        settle: Effect.fn("Approvals.settle")(function* (user, conversation) {
          const found = yield* conversations.find(user, conversation)
          if (Option.isNone(found)) return yield* recount(user)
          const changes = pendingCalls(found.value.messages).filter((call) => call.changes).length
          yield* conversations.setWaiting(conversation, changes)
          yield* recount(user)
        }),
        recount,
      })
    }),
  )
}
