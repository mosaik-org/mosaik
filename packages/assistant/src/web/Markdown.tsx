import { css, cx } from "@mosaik/styled-system/css"
import DOMPurify from "dompurify"
import { Marked } from "marked"
import { createMemo, type JSX } from "solid-js"
import { isLocalPath } from "./browserCalls"

const styles = css({
  lineHeight: "relaxed",
  overflowWrap: "anywhere",
  "& > * + *": { mt: "3" },
  "& ul, & ol": { pl: "5", "& > li + li": { mt: "1" } },
  "& ul": { listStyleType: "disc" },
  "& ol": { listStyleType: "decimal" },
  "& h1, & h2, & h3": { fontWeight: "semibold" },
  "& a": { color: "accent.plain.fg", textDecoration: "underline", textUnderlineOffset: "2px" },
  // Links to pages of Mosaik: chips, apart from links leaving it.
  "& a[data-place]": {
    px: "2",
    borderRadius: "full",
    bg: "accent.subtle.bg",
    textDecoration: "none",
    whiteSpace: "nowrap",
    _hover: { bg: "accent.subtle.bg.hover" },
  },
  "& code": { fontFamily: "mono", fontSize: "0.85em", bg: "gray.3", px: "1", py: "0.5", borderRadius: "l1" },
  "& [data-code]": { position: "relative" },
  "& pre": { bg: "gray.3", p: "3", pr: "16", borderRadius: "l2", overflowX: "auto", fontSize: "xs" },
  "& pre code": { bg: "transparent", p: "0" },
  "& [data-copy]": {
    position: "absolute",
    top: "2",
    right: "2",
    px: "2",
    py: "0.5",
    borderRadius: "l1",
    borderWidth: "1px",
    bg: "gray.surface.bg",
    fontSize: "xs",
    color: "fg.muted",
    cursor: "pointer",
    _hover: { color: "fg.default" },
  },
  // Wide tables scroll on their own instead of widening the reply.
  "& table": {
    display: "block",
    width: "fit-content",
    maxWidth: "full",
    overflowX: "auto",
    borderCollapse: "separate",
    borderSpacing: "0",
    borderWidth: "1px",
    borderRadius: "l2",
    fontSize: "xs",
  },
  "& th, & td": { px: "3", py: "1.5", textAlign: "start", borderBottomWidth: "1px", verticalAlign: "top" },
  "& th": { bg: "gray.2", fontWeight: "semibold", color: "fg.muted", whiteSpace: "nowrap" },
  "& tr:last-child td": { borderBottomWidth: "0" },
  "& tbody tr:nth-child(even) td": { bg: "gray.2/50" },
})

const sizes = { sm: css({ fontSize: "sm" }), md: css({ fontSize: "md" }) }

const escapeHtml = (text: string) =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;")

// Code blocks get a button to copy them (handled by the click below).
const markdown = new Marked({
  gfm: true,
  breaks: true,
  renderer: {
    code: ({ text }) =>
      `<div data-code><button type="button" data-copy>Copy</button><pre><code>${escapeHtml(text)}</code></pre></div>`,
  },
})

// The assistant's own sanitizer: links leaving Mosaik open in a new tab without access back to it;
// links to Mosaik are marked (`data-place`), to look like the places they open.
const purify = DOMPurify()
purify.addHook("afterSanitizeAttributes", (node) => {
  const href = node.getAttribute("href")
  if (node.tagName !== "A" || href === null) return
  if (isLocalPath(href)) {
    node.setAttribute("data-place", "")
    return
  }
  node.setAttribute("target", "_blank")
  node.setAttribute("rel", "noopener noreferrer")
})

/** Markdown as clean HTML. */
const render = (text: string) => purify.sanitize(markdown.parse(text, { async: false }))

const copyCode = (button: HTMLElement) => {
  const code = button.parentElement?.querySelector("pre")?.textContent ?? ""
  void navigator.clipboard.writeText(code).then(() => {
    button.textContent = "Copied"
    setTimeout(() => (button.textContent = "Copy"), 1500)
  })
}

/**
 * A reply's Markdown as HTML. Replies repeat what apps and people wrote, so the HTML is cleaned
 * (scripts, event handlers, `javascript:` links) before it is shown. Links to pages of Mosaik go
 * through `onNavigate` instead of reloading the page; code blocks can be copied.
 */
export const Markdown = (props: {
  readonly text: string
  readonly size?: "sm" | "md"
  readonly onNavigate?: (path: string) => void
}): JSX.Element => {
  const html = createMemo(() => render(props.text))
  const onClick = (event: MouseEvent) => {
    const target = event.target as Element | null
    const copy = target?.closest<HTMLElement>("[data-copy]")
    if (copy != null) return copyCode(copy)
    const href = target?.closest("a")?.getAttribute("href")
    // Modified clicks (new tab, new window) and other buttons stay the browser's.
    if (href == null || !isLocalPath(href) || props.onNavigate === undefined) return
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    props.onNavigate(href)
  }
  // Safe to insert: sanitized above. The click handler only catches clicks on the links and
  // buttons inside, which are focusable and fire their click on Enter: the container does nothing.
  // biome-ignore lint/a11y/noStaticElementInteractions lint/a11y/useKeyWithClickEvents: see above
  return <div class={cx(styles, sizes[props.size ?? "sm"])} innerHTML={html()} onClick={onClick} />
}
