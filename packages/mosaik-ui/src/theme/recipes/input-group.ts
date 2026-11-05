import { defineSlotRecipe } from "@pandacss/dev"

export const inputGroup = defineSlotRecipe({
  className: "input-group",
  slots: ["root", "element"],
  base: {
    root: {
      position: "relative",
      width: "full",
      // Room for what sits inside, read from the input's own height: square, as an icon's place is.
      "& > input:not(:first-child)": { ps: "var(--input-height)!" },
      "& > input:not(:last-child)": { pe: "var(--input-height)!" },
    },
    element: {
      alignItems: "center",
      color: "fg.muted",
      display: "flex",
      height: "full",
      justifyContent: "center",
      position: "absolute",
      zIndex: "2",
      // A click on an icon or a unit is a click on the input; a button inside takes its own.
      pointerEvents: "none",
      "& :is(a, button, input, select, textarea, [role=button], [tabindex])": { pointerEvents: "auto" },
      _icon: {
        color: "fg.subtle",
      },
    },
  },
  defaultVariants: {
    size: "md",
  },
  variants: {
    // As tall as the input of that size, its icon as large as a button's.
    size: {
      "2xs": { element: { minW: "5", _icon: { boxSize: "3" } } },
      xs: { element: { minW: "6", _icon: { boxSize: "3.5" } } },
      sm: { element: { minW: "7", _icon: { boxSize: "4" } } },
      md: { element: { minW: "8", _icon: { boxSize: "4" } } },
      lg: { element: { minW: "10", _icon: { boxSize: "5" } } },
      xl: { element: { minW: "12", _icon: { boxSize: "5.5" } } },
      "2xl": { element: { minW: "16", _icon: { boxSize: "6" } } },
    },
  },
})
