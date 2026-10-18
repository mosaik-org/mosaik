import type { Content, Severity } from "@mosaik/notifications/contract"
import { footerText, linkOf, paragraphs, type RenderOptions, severityOf } from "./common"

export { resolveLink } from "./common"

export interface RenderedEmail {
  readonly subject: string
  readonly text: string
  readonly html: string
}

const SUBJECT_PREFIX: Record<Severity, string> = {
  info: "",
  success: "",
  warning: "[Warning] ",
  critical: "[Critical] ",
}
const ACCENT: Record<Severity, string> = {
  info: "#2563eb",
  success: "#16a34a",
  warning: "#d97706",
  critical: "#dc2626",
}

const escapeHtml = (text: string) =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")

/** Renders channel-neutral content as an e-mail with HTML and plain-text bodies. */
export const renderEmail = (content: Content, options: RenderOptions): RenderedEmail => {
  const severity = severityOf(content)
  const link = linkOf(content, options.publicUrl)
  const body = paragraphs(content.body)
  const fields = content.fields ?? []
  const footer = `${footerText(options.source)}. This is an automated message.`

  const text = [
    content.title,
    ...body,
    ...(fields.length > 0 ? [fields.map((field) => `${field.label}: ${field.value}`).join("\n")] : []),
    ...(link ? [`${link.label}: ${link.url}`] : []),
    `-- \n${footer}`,
  ].join("\n\n")

  const accent = ACCENT[severity]
  const htmlParagraphs = body
    .map((p) => `<p style="margin:0 0 16px">${escapeHtml(p).replaceAll("\n", "<br>")}</p>`)
    .join("")
  const htmlFields =
    fields.length === 0
      ? ""
      : `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 16px;border-collapse:collapse">${fields
          .map(
            (field) =>
              `<tr><td style="padding:4px 16px 4px 0;color:#6b7280;vertical-align:top">${escapeHtml(field.label)}</td>` +
              `<td style="padding:4px 0;vertical-align:top">${escapeHtml(field.value).replaceAll("\n", "<br>")}</td></tr>`,
          )
          .join("")}</table>`
  const htmlButton = link
    ? `<p style="margin:24px 0 0"><a href="${escapeHtml(link.url)}" style="display:inline-block;padding:10px 18px;border-radius:6px;background:${accent};color:#ffffff;text-decoration:none;font-weight:600">${escapeHtml(link.label)}</a></p>`
    : ""

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(content.title)}</title></head>
<body style="margin:0;padding:24px 12px;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:#111827">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:8px;border-top:4px solid ${accent}">
<tr><td style="padding:28px 32px">
<h1 style="margin:0 0 16px;font-size:20px;line-height:1.3">${escapeHtml(content.title)}</h1>
${htmlParagraphs}${htmlFields}${htmlButton}
</td></tr></table>
<p style="max-width:600px;margin:16px auto 0;font-size:12px;color:#6b7280">${escapeHtml(footer)}</p>
</td></tr></table>
</body></html>`

  return { subject: `${SUBJECT_PREFIX[severity]}${content.title}`, text, html }
}
