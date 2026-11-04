import { datePickerAnatomy } from "@ark-ui/solid/anatomy"
import { defineSlotRecipe } from "@pandacss/dev"

export const datePicker = defineSlotRecipe({
  className: "date-picker",
  slots: datePickerAnatomy.keys(),
  base: {
    root: {
      display: "flex",
      flexDirection: "column",
      gap: "1.5",
    },
    content: {
      background: "gray.surface.bg",
      borderRadius: "l3",
      boxShadow: "lg",
      display: "flex",
      flexDirection: "column",
      gap: "3",
      p: "4",
      width: "344px",
      zIndex: "dropdown",
      _open: {
        animation: "fadeIn 0.25s ease-out",
      },
      _closed: {
        animation: "fade-out {durations.fast} {easings.exit}",
      },
      _hidden: {
        display: "none",
      },
    },
    control: {
      display: "flex",
      flexDirection: "row",
      gap: "2",
    },
    label: {
      color: "fg.default",
      fontWeight: "medium",
      textStyle: "sm",
    },
    tableHeader: {
      color: "fg.muted",
      fontWeight: "semibold",
      height: "10",
      textStyle: "sm",
    },
    viewControl: {
      display: "flex",
      gap: "2",
      justifyContent: "space-between",
    },
    table: {
      width: "full",
      borderCollapse: "separate",
      borderSpacing: "1",
      m: "-1",
    },
    tableCell: {
      textAlign: "center",
    },
    tableCellTrigger: {
      position: "relative",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      width: "full",
      minWidth: "9",
      height: "9",
      borderRadius: "l2",
      textStyle: "sm",
      cursor: "pointer",
      focusVisibleRing: "inside",
      _hover: { bg: "gray.subtle.bg.hover" },
      // Today: a dot under the number, in the text's color (so it shows on a selected day too).
      _today: {
        fontWeight: "semibold",
        _before: {
          content: "''",
          position: "absolute",
          bottom: "1",
          boxSize: "1",
          borderRadius: "full",
          bg: "currentColor",
        },
      },
      "&[data-in-range]": { bg: "colorPalette.subtle.bg", color: "colorPalette.subtle.fg" },
      _selected: {
        bg: "colorPalette.solid.bg",
        color: "colorPalette.solid.fg",
        _hover: { bg: "colorPalette.solid.bg.hover" },
      },
      "&[data-outside-range]": { color: "fg.subtle" },
      _disabled: { color: "fg.subtle", cursor: "not-allowed", _hover: { bg: "transparent" } },
      "&[data-unavailable]": { textDecoration: "line-through" },
    },
    view: {
      display: "flex",
      flexDirection: "column",
      gap: "3",
      _hidden: {
        display: "none",
      },
    },
  },
})
