import type { Content, Severity } from "@mosaik/notifications/contract"
import { footerText, linkOf, paragraphs, type RenderOptions, severityOf } from "./common"

const COLOR: Record<Severity, string> = { info: "Default", success: "Good", warning: "Warning", critical: "Attention" }

/** Renders channel-neutral content as an Adaptive Card (v1.5, as supported by Teams). */
export const renderTeams = (content: Content, options: RenderOptions): Record<string, unknown> => {
  const severity = severityOf(content)
  const link = linkOf(content, options.publicUrl)
  const fields = content.fields ?? []

  const body: Array<Record<string, unknown>> = [
    { type: "TextBlock", text: content.title, size: "Large", weight: "Bolder", color: COLOR[severity], wrap: true },
    ...paragraphs(content.body).map((paragraph) => ({ type: "TextBlock", text: paragraph, wrap: true })),
  ]
  if (fields.length > 0) {
    body.push({ type: "FactSet", facts: fields.map((field) => ({ title: field.label, value: field.value })) })
  }
  body.push({ type: "TextBlock", text: footerText(options.source), size: "Small", isSubtle: true, wrap: true })

  return {
    $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
    type: "AdaptiveCard",
    version: "1.5",
    msteams: { width: "Full" },
    body,
    actions: link ? [{ type: "Action.OpenUrl", title: link.label, url: link.url }] : [],
  }
}
