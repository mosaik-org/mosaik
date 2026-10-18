import { Smtp } from "@mosaik/connectors/smtp"
import { Effect } from "effect"
import type { SmtpConfig } from "../../NotificationsConfig"
import { renderEmail } from "../../render/email"
import { type Channel, DeliveryFailure } from "./Channel"

const quoteName = (name: string) => `"${name.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`

/** E-mail over SMTP. Checks the connection at startup (and only logs if it fails). */
export const make = Effect.fn("Email.make")(function* (config: SmtpConfig, publicUrl: string) {
  const smtp = yield* Smtp.make({ url: config.url, from: config.from })

  yield* smtp.health.pipe(
    Effect.tap((health) =>
      health.ok
        ? Effect.logInfo("SMTP server reachable", { latencyMs: Math.round(health.latencyMs) })
        : Effect.logWarning(`SMTP server check failed (${health.error}); e-mails will be retried`),
    ),
    Effect.forkScoped,
  )

  const channel: Channel = {
    name: "email",
    send: (delivery) => {
      const email = renderEmail(delivery.content, { publicUrl, source: delivery.source })
      return smtp
        .send({
          to:
            delivery.recipientName === null
              ? delivery.recipient
              : `${quoteName(delivery.recipientName)} <${delivery.recipient}>`,
          subject: email.subject,
          text: email.text,
          html: email.html,
          headers: {
            "Auto-Submitted": "auto-generated",
            "X-Mosaik-Source": delivery.source,
            "X-Mosaik-Message-Id": String(delivery.messageId),
          },
        })
        .pipe(
          Effect.map(({ messageId }) => ({ providerId: messageId.length > 0 ? messageId : null })),
          Effect.mapError(
            (error) =>
              new DeliveryFailure({
                message: `${error.reason}: ${error.message}`,
                permanent: error.reason === "BadRequest" || error.reason === "NotFound",
              }),
          ),
        )
    },
  }
  return channel
})
