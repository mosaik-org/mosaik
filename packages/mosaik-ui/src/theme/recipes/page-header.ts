import { defineSlotRecipe } from "@pandacss/dev"

/** A page's title row: an icon, the title and its description, and the page's actions. */
export const pageHeader = defineSlotRecipe({
  className: "page-header",
  slots: ["root", "heading", "icon", "content", "title", "description", "actions"],
  base: {
    root: {
      display: "flex",
      flexDirection: { base: "column", md: "row" },
      alignItems: { base: "flex-start", md: "center" },
      justifyContent: "space-between",
      gap: "4",
    },
    heading: { display: "flex", alignItems: "center", gap: "3", minW: "0" },
    icon: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: "0",
      boxSize: "10",
      borderRadius: "l3",
      bg: "colorPalette.subtle.bg",
      color: "colorPalette.subtle.fg",
      _icon: { boxSize: "5" },
    },
    content: { display: "flex", flexDirection: "column", gap: "0.5", minW: "0" },
    title: { textStyle: "2xl", fontWeight: "semibold", letterSpacing: "-0.01em", color: "fg.default" },
    description: { textStyle: "sm", color: "fg.muted" },
    actions: { display: "flex", alignItems: "center", flexWrap: "wrap", gap: "2" },
  },
})
