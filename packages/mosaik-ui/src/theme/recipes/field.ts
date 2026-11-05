import { fieldAnatomy } from "@ark-ui/solid/anatomy"
import { defineSlotRecipe } from "@pandacss/dev"

export const field = defineSlotRecipe({
  className: "field",
  slots: fieldAnatomy.keys(),
  base: {
    root: {
      gap: "1.5",
    },
    label: {
      alignItems: "center",
      color: "fg.default",
      display: "flex",
      gap: "0.5",
      textAlign: "start",
      userSelect: "none",
      textStyle: "label",
      _disabled: {
        layerStyle: "disabled",
      },
    },
    requiredIndicator: {
      color: "error",
    },
    helperText: {
      color: "fg.muted",
      textStyle: "sm",
      _disabled: {
        layerStyle: "disabled",
      },
    },
    errorText: {
      display: "inline-flex",
      alignItems: "center",
      gap: "1",
      color: "error",
      textStyle: "sm",
      _icon: { boxSize: "1em", flexShrink: "0" },
    },
  },
  defaultVariants: {
    orientation: "vertical",
  },
  variants: {
    orientation: {
      vertical: {
        root: { display: "flex", flexDirection: "column" },
      },
      // The label in a column of its own; the control, help and error line up in the next.
      horizontal: {
        root: {
          display: "grid",
          gridTemplateColumns: "var(--field-label-width, 8rem) minmax(0, 1fr)",
          alignItems: "center",
          columnGap: "3",
          "& > :not(label)": { gridColumn: "2" },
        },
      },
    },
  },
})
