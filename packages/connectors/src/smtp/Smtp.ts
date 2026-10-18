import { Duration, Effect, Redacted } from "effect"
import { createTransport } from "nodemailer"
import type { ConnectorHealth } from "../Connector"
import { ConnectorError, type ConnectorErrorReason } from "../ConnectorError"

export interface SmtpOptions {
  /**
   * Connection URL, e.g. `smtp://user:pass@mail.example.com:587` (STARTTLS) or
   * `smtps://user:pass@mail.example.com:465` (implicit TLS). Add `?pool=true` to reuse connections.
   */
  readonly url: Redacted.Redacted<string>
  /** Default sender, e.g. `Mosaik <mosaik@example.com>`. */
  readonly from: string
  /** Per message. Defaults to 30 seconds. */
  readonly timeout?: Duration.Input
}

export interface SmtpMail {
  readonly to: string
  readonly subject: string
  readonly text: string
  readonly html?: string
  /** Overrides the default sender. */
  readonly from?: string
  readonly replyTo?: string
  readonly headers?: Record<string, string>
}

export interface SmtpService {
  /** Hands the message to the SMTP server; resolves with the server's message id. */
  send(mail: SmtpMail): Effect.Effect<{ readonly messageId: string }, ConnectorError>
  /** Connects and authenticates without sending anything. */
  readonly health: Effect.Effect<ConnectorHealth>
}

const NAME = "SMTP"

const PERMANENT_CODES = new Set(["EENVELOPE", "EMESSAGE", "EMAXRECIPIENTS", "ECONFIG"])
const AUTH_CODES = new Set(["EAUTH", "ENOAUTH"])

/**
 * Maps nodemailer failures to connector errors. SMTP 5xx replies (unknown mailbox,
 * rejected content) are permanent (`BadRequest`); 4xx replies and network problems
 * are transient (`Unavailable`).
 */
export const toSmtpError = (error: unknown): ConnectorError => {
  const { code, responseCode, message, errors } = (error ?? {}) as {
    code?: string
    responseCode?: number
    message?: string
    /** Connection failures are `AggregateError`s (one per resolved address) with an empty message. */
    errors?: ReadonlyArray<{ message?: string }>
  }
  const detail =
    message ||
    errors
      ?.map((e) => e.message ?? "")
      .filter((m) => m.length > 0)
      .join("; ") ||
    code ||
    String(error)
  const reason: ConnectorErrorReason =
    (code !== undefined && AUTH_CODES.has(code)) || responseCode === 530 || responseCode === 535
      ? "Unauthorized"
      : responseCode !== undefined && responseCode >= 500
        ? "BadRequest"
        : responseCode === undefined && code !== undefined && PERMANENT_CODES.has(code)
          ? "BadRequest"
          : "Unavailable"
  return new ConnectorError({
    connector: NAME,
    reason,
    ...(responseCode === undefined ? {} : { status: responseCode }),
    message: detail,
  })
}

/** An SMTP client. The connection (pool) is closed when the scope closes. */
export const make = Effect.fn("Smtp.make")(function* (options: SmtpOptions) {
  const transport = yield* Effect.acquireRelease(
    Effect.sync(() => createTransport(Redacted.value(options.url), { from: options.from })),
    (transport) => Effect.sync(() => transport.close()),
  )
  const timeout = options.timeout ?? Duration.seconds(30)

  const send = (mail: SmtpMail) =>
    Effect.tryPromise({
      try: () =>
        transport.sendMail({
          to: mail.to,
          subject: mail.subject,
          text: mail.text,
          ...(mail.html === undefined ? {} : { html: mail.html }),
          ...(mail.from === undefined ? {} : { from: mail.from }),
          ...(mail.replyTo === undefined ? {} : { replyTo: mail.replyTo }),
          ...(mail.headers === undefined ? {} : { headers: mail.headers }),
        }),
      catch: toSmtpError,
    }).pipe(
      Effect.timeoutOrElse({
        duration: timeout,
        orElse: () =>
          Effect.fail(new ConnectorError({ connector: NAME, reason: "Unavailable", message: "SMTP send timed out" })),
      }),
      Effect.map((info) => ({ messageId: String(info.messageId ?? "") })),
      Effect.withSpan("SMTP send", { attributes: { "connector.name": NAME } }),
    )

  const health = Effect.tryPromise({ try: () => transport.verify(), catch: toSmtpError }).pipe(
    Effect.timeout(Duration.seconds(10)),
    Effect.timed,
    Effect.map(
      ([duration]): ConnectorHealth => ({ connector: NAME, ok: true, latencyMs: Duration.toMillis(duration) }),
    ),
    Effect.catch((error) =>
      Effect.succeed<ConnectorHealth>({
        connector: NAME,
        ok: false,
        latencyMs: 0,
        error: error instanceof ConnectorError ? error.reason : "Unavailable",
      }),
    ),
  )

  const service: SmtpService = { send, health }
  return service
})
