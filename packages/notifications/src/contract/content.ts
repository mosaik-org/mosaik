import { Schema } from "effect"

export const Severity = Schema.Literals(["info", "success", "warning", "critical"])
export type Severity = typeof Severity.Type

/**
 * An app path (`/sales/orders/42`, resolved against the public URL) or an absolute
 * http(s) URL. Protocol-relative (`//host`) and other schemes are rejected.
 */
export const Link = Schema.String.check(
  Schema.isMaxLength(2000),
  Schema.isPattern(/^(\/(?![/\\])|https?:\/\/)\S*$/, { message: "An app path starting with / or an http(s) URL" }),
)

const SingleLine = (maxLength: number) =>
  Schema.String.check(
    Schema.isMaxLength(maxLength),
    Schema.isPattern(/^[^\r\n]*$/, { message: "Must not contain line breaks" }),
  )

export const ContentField = Schema.Struct({
  label: SingleLine(100),
  value: Schema.String.check(Schema.isMaxLength(1000)),
})
export type ContentField = typeof ContentField.Type

/**
 * What a message says, independent of the channel. Each channel renders it its own way
 * (HTML + plain-text e-mail now; Teams and Slack cards later), so senders never write markup.
 */
export const Content = Schema.Struct({
  /** E-mail subject and headline. */
  title: SingleLine(200).check(Schema.isMinLength(1)),
  /** Plain text; blank lines separate paragraphs. */
  body: Schema.optional(Schema.String.check(Schema.isMaxLength(20_000))),
  /** Where to act on it, shown as a button. */
  link: Schema.optional(Link),
  /** Button label for `link`. Defaults to "Open in Mosaik" (or "Open" for external links). */
  linkLabel: Schema.optional(SingleLine(60)),
  /** Key facts shown as a small table, e.g. order number and amount. */
  fields: Schema.optional(Schema.Array(ContentField).check(Schema.isMaxLength(20))),
  /** Defaults to `info`. */
  severity: Schema.optional(Severity),
})
export type Content = typeof Content.Type
