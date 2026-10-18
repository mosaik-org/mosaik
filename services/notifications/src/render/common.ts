import type { Content, Severity } from "@mosaik/notifications/contract"

export interface RenderOptions {
  /** Public origin of the app; app paths (`/sales/...`) are resolved against it. */
  readonly publicUrl: string
  /** Sending service, shown in the footer. */
  readonly source: string
}

/** Absolute URL of a content link; app paths are resolved against the public URL. */
export const resolveLink = (link: string, publicUrl: string): string =>
  link.startsWith("/") ? new URL(link, publicUrl).toString() : link

/** The content's link as an absolute URL with its button label. */
export const linkOf = (content: Content, publicUrl: string) =>
  content.link === undefined
    ? undefined
    : {
        url: resolveLink(content.link, publicUrl),
        label: content.linkLabel ?? (content.link.startsWith("/") ? "Open in Mosaik" : "Open"),
      }

/** Body split into trimmed, non-empty paragraphs (blank lines separate them). */
export const paragraphs = (body: string | undefined): ReadonlyArray<string> =>
  (body ?? "")
    .replaceAll("\r\n", "\n")
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0)

export const severityOf = (content: Content): Severity => content.severity ?? "info"

export const footerText = (source: string) => `Sent by Mosaik (${source})`
