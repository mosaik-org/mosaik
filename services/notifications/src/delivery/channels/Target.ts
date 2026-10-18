import { Slack, type SlackService } from "@mosaik/connectors/slack"
import { Teams } from "@mosaik/connectors/teams"
import type { Content } from "@mosaik/notifications/contract"
import { Effect, Option } from "effect"
import { HttpClient } from "effect/http"
import { renderSlack } from "../../render/slack"
import { renderTeams } from "../../render/teams"
import type { StoredTarget, Targets } from "../../targets/Targets"
import { type Channel, DeliveryFailure } from "./Channel"
import { toDeliveryFailure } from "./failure"

export interface TargetSender {
  /** Renders `content` for the target's platform and posts it. */
  post(
    target: StoredTarget,
    content: Content,
    source: string,
  ): Effect.Effect<{ readonly providerId: string | null }, DeliveryFailure>
}

/** Posts to Teams workflow webhooks, Slack webhooks and (with a bot token) Slack channels. */
export const makeSender = (
  slack: Option.Option<SlackService>,
  publicUrl: string,
  http: HttpClient.HttpClient,
): TargetSender => ({
  post: (target, content, source) => {
    const options = { publicUrl, source }
    const config = target.config
    if (config.kind === "slack-channel") {
      return Option.match(slack, {
        onNone: () =>
          Effect.fail(new DeliveryFailure({ message: "SLACK_BOT_TOKEN is not configured", permanent: true })),
        onSome: (client) =>
          client.postMessage({ channel: config.channel, ...renderSlack(content, options) }).pipe(
            Effect.mapError(toDeliveryFailure),
            Effect.map((posted) => ({ providerId: posted.ts.length > 0 ? posted.ts : null })),
          ),
      })
    }
    const posted =
      config.kind === "teams-webhook"
        ? Teams.postCard(config.url, renderTeams(content, options))
        : Slack.postWebhook(config.url, renderSlack(content, options))
    return posted.pipe(
      Effect.as({ providerId: null }),
      Effect.mapError(toDeliveryFailure),
      Effect.provideService(HttpClient.HttpClient, http),
    )
  },
})

/** Deliveries to admin-configured targets (the recipient is the target id). */
export const make = (targets: Targets["Service"], sender: TargetSender): Channel => ({
  name: "target",
  send: (delivery) =>
    targets.get(delivery.recipient).pipe(
      Effect.flatMap(
        Option.match({
          onNone: () =>
            Effect.fail(
              new DeliveryFailure({ message: `Target "${delivery.recipient}" was deleted`, permanent: true }),
            ),
          onSome: (target) => sender.post(target, delivery.content, delivery.source),
        }),
      ),
    ),
})
