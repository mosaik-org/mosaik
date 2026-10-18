import { css, cva } from "@mosaik/styled-system/css"

export const popoverContentStyles = css({
  display: "flex",
  flexDirection: "column",
  gap: "0.5",
  minW: "40",
  maxH: "min(var(--available-height, 320px), 320px)",
  overflowY: "auto",
  p: "1",
  bg: "bg.surface",
  color: "fg.default",
  borderRadius: "control",
  boxShadow: "popover",
  outline: "none",
  zIndex: "50",
  transformOrigin: "var(--transform-origin)",
  _open: { animation: "scaleIn 120ms ease-out" },
  _closed: { animation: "scaleOut 100ms ease-in" },
})

export const popoverItemRecipe = cva({
  base: {
    display: "flex",
    alignItems: "center",
    gap: "2",
    minH: "8",
    px: "2",
    borderRadius: "sm",
    fontSize: "sm",
    color: "fg.default",
    cursor: "pointer",
    userSelect: "none",
    outline: "none",
    "& svg": { boxSize: "4", flexShrink: "0", color: "fg.muted" },
    _highlighted: { bg: "bg.muted" },
    _disabled: { opacity: "0.5", cursor: "not-allowed" },
  },
  variants: {
    danger: {
      true: {
        color: "danger.text",
        "& svg": { color: "danger.text" },
        _highlighted: { bg: "danger.subtle" },
      },
    },
  },
})
