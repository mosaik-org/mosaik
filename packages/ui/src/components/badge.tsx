import { cva, cx } from "@mosaik/styled-system/css"
import { type JSX, mergeProps } from "solid-js"

export type BadgeTone = "neutral" | "accent" | "success" | "warning" | "danger"

const badge = cva({
  base: {
    display: "inline-flex",
    alignItems: "center",
    gap: "1",
    h: "5",
    px: "2",
    borderRadius: "full",
    fontSize: "xs",
    fontWeight: "medium",
    lineHeight: "1",
    whiteSpace: "nowrap",
    "& svg": { boxSize: "3" },
  },
  variants: {
    tone: {
      neutral: { bg: "bg.muted", color: "fg.muted" },
      accent: { bg: "accent.subtle", color: "accent.text" },
      success: { bg: "success.subtle", color: "success.text" },
      warning: { bg: "warning.subtle", color: "warning.text" },
      danger: { bg: "danger.subtle", color: "danger.text" },
    },
  },
  defaultVariants: { tone: "neutral" },
})

export interface BadgeProps {
  tone?: BadgeTone
  class?: string
  children?: JSX.Element
}

export function Badge(props: BadgeProps) {
  const merged = mergeProps({ tone: "neutral" as BadgeTone }, props)
  return <span class={cx(badge({ tone: merged.tone }), merged.class)}>{merged.children}</span>
}
