import { defineSlotRecipe } from "@pandacss/dev"

/** Light, Dark and System as one row of a menu: its name, then the three as pressed-or-not buttons. */
export const themeChoice = defineSlotRecipe({
  className: "theme-choice",
  slots: ["root", "label", "options", "option"],
  base: {
    root: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "4", px: "2", py: "1" },
    label: { textStyle: "sm", color: "fg.muted" },
    options: { display: "flex", gap: "0.5", p: "0.5", borderRadius: "l2", bg: "gray.subtle.bg" },
    option: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      width: "8",
      height: "7",
      borderRadius: "l1",
      color: "fg.muted",
      cursor: "pointer",
      outline: "0",
      _icon: { boxSize: "4" },
      _highlighted: { bg: "gray.surface.bg.hover", color: "fg.default" },
      _checked: { bg: "gray.surface.bg", color: "fg.default", boxShadow: "xs" },
    },
  },
})
