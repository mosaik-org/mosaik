import { css, cx } from "@mosaik/styled-system/css"
import type { JSX } from "solid-js"

const kbd = css({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minW: "5",
  h: "5",
  px: "1",
  bg: "bg.subtle",
  color: "fg.muted",
  borderWidth: "1px",
  borderBottomWidth: "2px",
  borderColor: "border.default",
  borderRadius: "sm",
  fontFamily: "mono",
  fontSize: "xs",
  lineHeight: "1",
})

export function Kbd(props: { children: JSX.Element; class?: string }) {
  return <kbd class={cx(kbd, props.class)}>{props.children}</kbd>
}
