import { checkboxAnatomy } from "@ark-ui/solid/anatomy"
import { defineSlotRecipe } from "@pandacss/dev"

export const checkbox = defineSlotRecipe({
  slots: checkboxAnatomy.keys(),
  className: "checkbox",
  base: {
    root: {
      // Checked, chosen or filled in the accent: what the person set, or is doing.
      colorPalette: "accent",
      display: "inline-flex",
      gap: "2",
      alignItems: "center",
      verticalAlign: "top",
      position: "relative",
      // All of it, as a click on the label counts too.
      cursor: "pointer",
      _disabled: {
        layerStyle: "disabled",
      },
    },
    control: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: "0",
      borderWidth: "1px",
      borderColor: "transparent",
      borderRadius: "l1",
      focusVisibleRing: "outside",

      _icon: {
        boxSize: "full",
      },
    },
    label: {
      fontWeight: "medium",
      userSelect: "none",
    },
  },

  variants: {
    size: {
      sm: {
        root: { gap: "2" },
        label: { textStyle: "sm" },
        control: { boxSize: "3.5", _icon: { boxSize: "2.5" } },
      },
      md: {
        root: { gap: "2.5" },
        label: { textStyle: "sm" },
        control: { boxSize: "4", _icon: { boxSize: "3" } },
      },
      lg: {
        root: { gap: "3" },
        label: { textStyle: "md" },
        control: { boxSize: "5", _icon: { boxSize: "4" } },
      },
    },

    // Grey until checked, in every variant: the accent says what the person set. Each has its own
    // `_invalid`, as a variant's border beats one in the base.
    variant: {
      solid: {
        control: {
          // A control's edge, not a divider: visible however faint the lines around it.
          borderColor: "gray.outline.border",
          _checked: {
            bg: "colorPalette.solid.bg",
            borderColor: "colorPalette.solid.bg",
            color: "colorPalette.solid.fg",
          },
          _invalid: { borderColor: "error" },
        },
      },
      surface: {
        control: {
          bg: "gray.surface.bg",
          borderColor: "gray.surface.border",
          _checked: {
            bg: "colorPalette.surface.bg",
            borderColor: "colorPalette.surface.border",
            color: "colorPalette.surface.fg",
          },
          _invalid: { borderColor: "error" },
        },
      },
      subtle: {
        control: {
          bg: "gray.subtle.bg",
          _checked: {
            bg: "colorPalette.subtle.bg",
            color: "colorPalette.subtle.fg",
          },
          _invalid: { borderColor: "error" },
        },
      },
      outline: {
        control: {
          borderColor: "gray.outline.border",
          _checked: {
            borderColor: "colorPalette.solid.bg",
            color: "colorPalette.outline.fg",
          },
          _invalid: { borderColor: "error" },
        },
      },
      plain: {
        control: {
          _checked: {
            color: "colorPalette.plain.fg",
          },
          _invalid: { borderColor: "error" },
        },
      },
    },
  },

  defaultVariants: {
    variant: "solid",
    size: "md",
  },
})
