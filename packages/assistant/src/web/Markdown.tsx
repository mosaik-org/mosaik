import { css } from "@mosaik/styled-system/css"
import DOMPurify from "dompurify"
import { marked } from "marked"
import { createMemo } from "solid-js"
import { isLocalPath } from "./browserCalls"

const styles = css({
  fontSize: "sm",
  lineHeight: "relaxed",
  overflowWrap: "anywhere",
  "& > * + *": { mt: "2" },
  "& ul, & ol": { pl: "5" },
  "& ul": { listStyleType: "disc" },
  "& ol": { listStyleType: "decimal" },
  "& a": { color: "accent.text", textDecoration: "underline" },
  "& code": { fontFamily: "mono", fontSize: "xs", bg: "gray.3", px: "1", borderRadius: "l1" },
  "& pre": { bg: "gray.3", p: "2", borderRadius: "l2", overflowX: "auto" },
  "& pre code": { bg: "transparent", p: "0" },
  "& table": { width: "full", borderCollapse: "collapse", fontSize: "xs" },
  "& th, & td": { borderWidth: "1px", px: "2", py: "1", textAlign: "start" },
  "& h1, & h2, & h3": { fontWeight: "semibold" },
})

// The assistant's own sanitizer: links leaving Mosaik open in a new tab, without access back to it.
const purify = DOMPurify()
purify.addHook("afterSanitizeAttributes", (node) => {
  const href = node.getAttribute("href")
  if (node.tagName !== "A" || href === null || isLocalPath(href)) return
  node.setAttribute("target", "_blank")
  node.setAttribute("rel", "noopener noreferrer")
})

/**
 * A reply's Markdown as HTML. Replies repeat what apps and people wrote, so the HTML is cleaned
 * (scripts, event handlers, `javascript:` links) before it is shown. Links to pages of Mosaik go
 * through `onNavigate` instead of reloading the page.
 */
export const Markdown = (props: { readonly text: string; readonly onNavigate?: (path: string) => void }) => {
  const html = createMemo(() => purify.sanitize(marked.parse(props.text, { async: false, gfm: true, breaks: true })))
  const follow = (event: MouseEvent) => {
    const link = (event.target as Element | null)?.closest("a")
    const href = link?.getAttribute("href")
    // Modified clicks (new tab, new window) and other buttons stay the browser's.
    if (href == null || !isLocalPath(href) || props.onNavigate === undefined) return
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    props.onNavigate(href)
  }
  // Safe to insert: sanitized above. The click handler only catches clicks on the links inside,
  // which are links (focusable, Enter fires their click): the container itself does nothing.
  // biome-ignore lint/a11y/noStaticElementInteractions lint/a11y/useKeyWithClickEvents: see above
  return <div class={styles} innerHTML={html()} onClick={follow} />
}
