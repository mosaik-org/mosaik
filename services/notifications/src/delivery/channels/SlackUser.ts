import type { SlackService } from "@mosaik/connectors/slack"
import { Effect, Option } from "effect"
import { renderSlack } from "../../render/slack"
import { type Channel, DeliveryFailure } from "./Channel"
import { toDeliveryFailure } from "./failure"

/** Direct messages to Mosaik users, found in the Slack workspace by their e-mail address. */
export const make = (slack: SlackService, publicUrl: string): Channel => ({
  name: "slack-user",
  send: (delivery) =>
    Effect.gen(function* () {
      const userId = yield* slack.lookupUserByEmail(delivery.recipient).pipe(Effect.mapError(toDeliveryFailure))
      if (Option.isNone(userId)) {
        return yield* new DeliveryFailure({
          message: `No Slack account for ${delivery.recipient}`,
          permanent: true,
        })
      }
      const message = renderSlack(delivery.content, { publicUrl, source: delivery.source })
      const posted = yield* slack
        .postMessage({ channel: userId.value, ...message })
        .pipe(Effect.mapError(toDeliveryFailure))
      return { providerId: posted.ts.length > 0 ? posted.ts : null }
    }),
})
