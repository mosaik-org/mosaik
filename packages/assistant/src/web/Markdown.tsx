import { css } from "@mosaik/styled-system/css"
import DOMPurify from "dompurify"
import { marked } from "marked"
import { createMemo } from "solid-js"

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

/**
 * A reply's Markdown as HTML. Replies repeat what apps and people wrote, so the HTML is cleaned
 * (scripts, event handlers, `javascript:` links) before it is shown.
 */
export const Markdown = (props: { readonly text: string }) => {
  const html = createMemo(() => DOMPurify.sanitize(marked.parse(props.text, { async: false, gfm: true, breaks: true })))
  // Safe to insert: sanitized above.
  return <div class={styles} innerHTML={html()} />
}
