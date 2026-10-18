import { Duration, Effect, Option, type Redacted, Schema } from "effect"
import * as Auth from "../Auth"
import * as Connector from "../Connector"
import { ConnectorError, type ConnectorErrorReason } from "../ConnectorError"
import * as Webhook from "../Webhook"

export interface SlackOptions {
  /** Bot token (`xoxb-…`) with `chat:write` and `users:read.email`. */
  readonly token: Redacted.Redacted<string>
  /** Defaults to `https://slack.com/api`. */
  readonly baseUrl?: URL
}

export interface SlackMessage {
  /** Channel id (`C…`), user id (`U…`, sends a DM) or `#name`. */
  readonly channel: string
  /** Plain-text fallback, used in notifications and by screen readers. */
  readonly text: string
  /** Block Kit blocks. */
  readonly blocks?: ReadonlyArray<unknown>
}

export interface SlackService {
  postMessage(message: SlackMessage): Effect.Effect<{ readonly channel: string; readonly ts: string }, ConnectorError>
  /** The Slack user id for an e-mail address, if the workspace has such a member. */
  lookupUserByEmail(email: string): Effect.Effect<Option.Option<string>, ConnectorError>
  /** Checks the token (`auth.test`). */
  readonly health: Effect.Effect<Connector.ConnectorHealth>
}

const NAME = "Slack"

/** Slack answers HTTP 200 with `{ ok: false, error }` for most failures. */
const SlackResponse = Schema.Struct({
  ok: Schema.Boolean,
  error: Schema.optional(Schema.String),
  channel: Schema.optional(Schema.String),
  ts: Schema.optional(Schema.String),
  user: Schema.optional(Schema.Struct({ id: Schema.String })),
})

const REASONS: Record<string, ConnectorErrorReason> = {
  invalid_auth: "Unauthorized",
  not_authed: "Unauthorized",
  account_inactive: "Unauthorized",
  token_revoked: "Unauthorized",
  token_expired: "Unauthorized",
  missing_scope: "Unauthorized",
  channel_not_found: "NotFound",
  users_not_found: "NotFound",
  user_not_found: "NotFound",
  ratelimited: "RateLimited",
  rate_limited: "RateLimited",
  not_in_channel: "BadRequest",
  is_archived: "BadRequest",
  invalid_blocks: "BadRequest",
  invalid_arguments: "BadRequest",
  msg_too_long: "BadRequest",
  no_text: "BadRequest",
  too_many_attachments: "BadRequest",
}

/** Maps a Slack `error` code to a connector error; unknown codes count as transient. */
export const slackError = (code: string): ConnectorError =>
  new ConnectorError({ connector: NAME, reason: REASONS[code] ?? "Unavailable", message: code })

const ensureOk = (response: typeof SlackResponse.Type) =>
  response.ok ? Effect.succeed(response) : Effect.fail(slackError(response.error ?? "unknown_error"))

/** Slack Web API client for a bot token. */
export const make = Effect.fn("Slack.make")(function* (options: SlackOptions) {
  const connector = yield* Connector.make({
    name: NAME,
    baseUrl: options.baseUrl ?? new URL("https://slack.com/api"),
    auth: Auth.bearer(options.token),
    // chat.postMessage allows about one message per second per channel.
    rateLimit: { limit: 60, window: "1 minute" },
  })

  const service: SlackService = {
    postMessage: (message) =>
      connector
        .post("/chat.postMessage", SlackResponse, {
          body: {
            channel: message.channel,
            text: message.text,
            ...(message.blocks === undefined ? {} : { blocks: message.blocks }),
            unfurl_links: false,
          },
        })
        .pipe(
          Effect.flatMap(ensureOk),
          Effect.map((response) => ({ channel: response.channel ?? message.channel, ts: response.ts ?? "" })),
        ),

    lookupUserByEmail: (email) =>
      connector
        .get("/users.lookupByEmail", SlackResponse, { query: { email } })
        .pipe(
          Effect.flatMap((response) =>
            response.ok
              ? Effect.succeed(Option.fromUndefinedOr(response.user?.id))
              : response.error === "users_not_found"
                ? Effect.succeed(Option.none())
                : Effect.fail(slackError(response.error ?? "unknown_error")),
          ),
        ),

    health: connector.post("/auth.test", SlackResponse).pipe(
      Effect.flatMap(ensureOk),
      Effect.timed,
      Effect.map(
        ([duration]): Connector.ConnectorHealth => ({
          connector: NAME,
          ok: true,
          latencyMs: Duration.toMillis(duration),
        }),
      ),
      Effect.catch((error) =>
        Effect.succeed<Connector.ConnectorHealth>({ connector: NAME, ok: false, latencyMs: 0, error: error.reason }),
      ),
    ),
  }
  return service
})

/** Posts to a Slack incoming webhook (`https://hooks.slack.com/services/…`). */
export const postWebhook = (
  url: Redacted.Redacted<string>,
  message: { readonly text: string; readonly blocks?: ReadonlyArray<unknown> },
) => Webhook.post("Slack webhook", url, message).pipe(Effect.asVoid)
