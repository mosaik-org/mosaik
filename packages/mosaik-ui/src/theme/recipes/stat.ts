import { defineSlotRecipe } from "@pandacss/dev"

/** A number worth watching: its label, the value, a trend against a previous period, a hint. */
export const stat = defineSlotRecipe({
  className: "stat",
  slots: ["root", "label", "valueRow", "value", "trend", "hint"],
  base: {
    root: { display: "flex", flexDirection: "column", gap: "1.5", p: "5" },
    label: { textStyle: "sm", fontWeight: "medium", color: "fg.muted" },
    valueRow: { display: "flex", alignItems: "baseline", flexWrap: "wrap", gap: "2" },
    value: {
      textStyle: "2xl",
      fontWeight: "semibold",
      letterSpacing: "-0.01em",
      fontVariantNumeric: "tabular-nums",
      color: "fg.default",
    },
    trend: {
      display: "inline-flex",
      alignItems: "center",
      gap: "0.5",
      textStyle: "xs",
      fontWeight: "medium",
      fontVariantNumeric: "tabular-nums",
      _icon: { boxSize: "3.5" },
    },
    hint: { textStyle: "xs", color: "fg.subtle" },
  },
  defaultVariants: { direction: "flat" },
  variants: {
    direction: {
      up: { trend: { color: "success.plain.fg" } },
      down: { trend: { color: "danger.plain.fg" } },
      flat: { trend: { color: "fg.muted" } },
    },
  },
})
