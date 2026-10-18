import { Effect, type Redacted } from "effect"
import * as Webhook from "../Webhook"

/**
 * Posts an Adaptive Card to a Teams channel through a Workflows webhook ("Post to a
 * channel when a webhook request is received"). The older Office 365 connector webhooks
 * are retired by Microsoft and not supported.
 */
export const postCard = (url: Redacted.Redacted<string>, card: Record<string, unknown>) =>
  Webhook.post("Teams", url, {
    type: "message",
    attachments: [{ contentType: "application/vnd.microsoft.card.adaptive", contentUrl: null, content: card }],
  }).pipe(Effect.asVoid)
