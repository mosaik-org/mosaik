import { Config, Context, Duration, Effect, Layer, Option, Redacted } from "effect"
import { DomainPolicy } from "./messages/DomainPolicy"

export interface SlackConfig {
  /** Bot token: Slack channel targets and direct messages to users. */
  readonly token: Redacted.Redacted<string>
  readonly apiUrl: URL
}

export interface SmtpConfig {
  readonly url: Redacted.Redacted<string>
  /** Sender of every message, e.g. `Mosaik <mosaik@example.com>`. */
  readonly from: string
}

/** Notifications service configuration, read from the environment. */
export class NotificationsConfig extends Context.Service<
  NotificationsConfig,
  {
    /** Public origin of the app; app paths in links are resolved against it. */
    readonly publicUrl: string
    /** E-mail delivery; destinations that need it are rejected when unset. */
    readonly smtp: Option.Option<SmtpConfig>
    /** Slack app; without it only Slack webhook targets work (no channel targets, no DMs). */
    readonly slack: Option.Option<SlackConfig>
    /** Which external e-mail addresses may receive messages. */
    readonly allowedDomains: DomainPolicy
    /** Deliveries (destinations) each source may queue per minute. */
    readonly deliveriesPerMinute: number
    /** Attempts per delivery before it is marked failed. */
    readonly maxAttempts: number
    /** How long resolved items, and information read and left, stay in inboxes. */
    readonly inboxRetention: Duration.Duration
  }
>()("@mosaik/notifications-service/NotificationsConfig") {
  static readonly layer = Layer.effect(
    NotificationsConfig,
    Effect.gen(function* () {
      // Docker compose passes unset optional variables as empty strings.
      const smtpUrl = yield* Config.Redacted("SMTP_URL").pipe(Config.withDefault(Redacted.make("")))
      const from = yield* Config.String("MAIL_FROM").pipe(Config.withDefault(""))
      const smtp: Option.Option<SmtpConfig> =
        Redacted.value(smtpUrl).length > 0 ? Option.some({ url: smtpUrl, from }) : Option.none()
      if (Option.isSome(smtp) && from.length === 0) {
        return yield* Effect.fail(new Error("MAIL_FROM is required when SMTP_URL is set"))
      }
      if (Option.isNone(smtp)) {
        yield* Effect.logWarning("E-mail is not configured (SMTP_URL, MAIL_FROM): e-mail messages are rejected")
      }

      const slackToken = yield* Config.Redacted("SLACK_BOT_TOKEN").pipe(Config.withDefault(Redacted.make("")))
      const slack: Option.Option<SlackConfig> =
        Redacted.value(slackToken).length > 0
          ? Option.some({
              token: slackToken,
              apiUrl: yield* Config.URL("SLACK_API_URL").pipe(Config.withDefault(new URL("https://slack.com/api"))),
            })
          : Option.none()

      return NotificationsConfig.of({
        publicUrl: yield* Config.String("PUBLIC_URL"),
        smtp,
        slack,
        allowedDomains: DomainPolicy.parse(yield* Config.String("MAIL_ALLOWED_DOMAINS").pipe(Config.withDefault(""))),
        deliveriesPerMinute: yield* Config.Int("MESSAGES_PER_MINUTE").pipe(Config.withDefault(120)),
        maxAttempts: yield* Config.Int("DELIVERY_MAX_ATTEMPTS").pipe(Config.withDefault(8)),
        inboxRetention: Duration.days(
          Math.max(1, yield* Config.Int("INBOX_RETENTION_DAYS").pipe(Config.withDefault(30))),
        ),
      })
    }),
  )
}
