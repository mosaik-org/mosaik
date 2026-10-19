import { defineSlotRecipe } from "@pandacss/dev"

/** A centered message for a place with nothing to show (no results, no access) or that failed. */
export const emptyState = defineSlotRecipe({
  className: "empty-state",
  slots: ["root", "icon", "content", "title", "description", "action"],
  base: {
    root: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: "3",
      py: "12",
      px: "6",
      textAlign: "center",
    },
    icon: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      boxSize: "12",
      borderRadius: "full",
      bg: "colorPalette.subtle.bg",
      color: "colorPalette.subtle.fg",
      _icon: { boxSize: "6" },
    },
    content: { display: "flex", flexDirection: "column", gap: "1", maxW: "md" },
    title: { textStyle: "md", fontWeight: "semibold", color: "fg.default" },
    description: { textStyle: "sm", color: "fg.muted", overflowWrap: "anywhere" },
    action: { mt: "2" },
  },
  defaultVariants: { tone: "neutral" },
  variants: {
    tone: {
      neutral: { root: { colorPalette: "gray" } },
      danger: { root: { colorPalette: "danger" } },
    },
  },
})
