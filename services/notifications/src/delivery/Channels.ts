import { Slack } from "@mosaik/connectors/slack"
import type { PersonalChannel } from "@mosaik/core"
import { Context, Effect, Layer, Option } from "effect"
import { HttpClient } from "effect/http"
import { NotificationsConfig } from "../NotificationsConfig"
import { Targets } from "../targets/Targets"
import type { Channel, ChannelName } from "./channels/Channel"
import * as Email from "./channels/Email"
import * as SlackUser from "./channels/SlackUser"
import * as Target from "./channels/Target"

/** The delivery channels configured for this deployment. */
export class Channels extends Context.Service<
  Channels,
  {
    get(name: string): Option.Option<Channel>
    has(name: ChannelName): boolean
    /** Personal channels users can choose (in-app always; e-mail with SMTP; Slack with a bot token). */
    readonly personal: ReadonlyArray<PersonalChannel>
    /** Posts straight to a target, e.g. to test it. */
    readonly targets: Target.TargetSender
  }
>()("@mosaik/notifications-service/Channels") {
  static readonly layer = Layer.effect(
    Channels,
    Effect.gen(function* () {
      const config = yield* NotificationsConfig
      const targets = yield* Targets
      const http = yield* HttpClient.HttpClient
      const configured = new Map<string, Channel>()

      if (Option.isSome(config.smtp)) {
        const email = yield* Email.make(config.smtp.value, config.publicUrl)
        configured.set(email.name, email)
      }

      const slack = Option.isSome(config.slack)
        ? Option.some(
            yield* Slack.make({ token: config.slack.value.token, baseUrl: config.slack.value.apiUrl }).pipe(
              Effect.provideService(HttpClient.HttpClient, http),
            ),
          )
        : Option.none()
      if (Option.isSome(slack)) {
        configured.set("slack-user", SlackUser.make(slack.value, config.publicUrl))
        yield* slack.value.health.pipe(
          Effect.tap((health) =>
            health.ok
              ? Effect.logInfo("Slack app reachable")
              : Effect.logWarning(`Slack check failed (${health.error}); Slack messages will be retried`),
          ),
          Effect.forkScoped,
        )
      }

      const sender = Target.makeSender(slack, config.publicUrl, http)
      configured.set("target", Target.make(targets, sender))

      return Channels.of({
        get: (name) => Option.fromUndefinedOr(configured.get(name)),
        has: (name) => configured.has(name),
        personal: [
          "inApp",
          ...(configured.has("email") ? ["email" as const] : []),
          ...(Option.isSome(slack) ? ["slack" as const] : []),
        ],
        targets: sender,
      })
    }),
  )
}
