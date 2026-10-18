import type { Content, Severity } from "@mosaik/notifications/contract"
import { footerText, linkOf, paragraphs, type RenderOptions, severityOf } from "./common"

export interface RenderedSlack {
  /** Fallback for notifications and clients without Block Kit. */
  readonly text: string
  readonly blocks: ReadonlyArray<Record<string, unknown>>
}

const EMOJI: Record<Severity, string> = {
  info: "",
  success: ":white_check_mark: ",
  warning: ":warning: ",
  critical: ":rotating_light: ",
}

/** Slack `mrkdwn` treats `&`, `<` and `>` as control characters. */
export const escapeMrkdwn = (text: string) =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")

const truncate = (text: string, max: number) => (text.length <= max ? text : `${text.slice(0, max - 1)}…`)

/** Renders channel-neutral content as Slack Block Kit blocks with a plain-text fallback. */
export const renderSlack = (content: Content, options: RenderOptions): RenderedSlack => {
  const severity = severityOf(content)
  const link = linkOf(content, options.publicUrl)
  const body = paragraphs(content.body)
  const fields = content.fields ?? []

  const blocks: Array<Record<string, unknown>> = [
    {
      type: "header",
      text: { type: "plain_text", text: truncate(`${EMOJI[severity]}${content.title}`, 150), emoji: true },
    },
  ]
  if (body.length > 0) {
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: truncate(body.map(escapeMrkdwn).join("\n\n"), 3000) },
    })
  }
  // A section holds at most 10 fields.
  for (let i = 0; i < fields.length; i += 10) {
    blocks.push({
      type: "section",
      fields: fields.slice(i, i + 10).map((field) => ({
        type: "mrkdwn",
        text: truncate(`*${escapeMrkdwn(field.label)}*\n${escapeMrkdwn(field.value)}`, 2000),
      })),
    })
  }
  if (link) {
    blocks.push({
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: truncate(link.label, 75) },
          url: link.url,
          ...(severity === "critical" ? { style: "danger" } : {}),
        },
      ],
    })
  }
  blocks.push({ type: "context", elements: [{ type: "mrkdwn", text: escapeMrkdwn(footerText(options.source)) }] })

  const text = [content.title, body[0]].filter((part) => part !== undefined).join("\n")
  return { text: truncate(text, 3000), blocks }
}
