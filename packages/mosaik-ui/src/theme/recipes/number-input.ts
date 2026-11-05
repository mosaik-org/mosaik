import { numberInputAnatomy } from "@ark-ui/solid/anatomy"
import { defineSlotRecipe } from "@pandacss/dev"
import { input } from "./input"

/** Up and down: small rounded buttons inside the field, without lines, lit on hover. */
const trigger = {
  alignItems: "center",
  borderRadius: "l1",
  color: "fg.subtle",
  cursor: "pointer",
  display: "flex",
  flex: "1",
  justifyContent: "center",
  lineHeight: "1",
  transition: "common",
  userSelect: "none",
  _icon: {
    boxSize: "1em",
  },
  _hover: {
    bg: "gray.subtle.bg",
    color: "fg.default",
  },
  _active: {
    bg: "gray.subtle.bg.hover",
  },
}

export const numberInput = defineSlotRecipe({
  className: "number-input",
  slots: numberInputAnatomy.keys(),
  base: {
    root: {
      isolation: "isolate",
      position: "relative",
      _disabled: {
        layerStyle: "disabled",
      },
    },
    control: {
      display: "flex",
      flexDirection: "column",
      gap: "px",
      height: "calc(100% - 8px)",
      insetEnd: "0px",
      margin: "4px",
      position: "absolute",
      top: "0",
      width: "var(--stepper-width)",
      zIndex: "1",
    },
    input: {
      ...input.base,
      verticalAlign: "top",
      pe: "calc(var(--stepper-width) + 0.5rem)",
    },
    label: {
      color: "fg.default",
      fontWeight: "medium",
    },
    incrementTrigger: {
      ...trigger,
    },
    decrementTrigger: {
      ...trigger,
    },
  },
  defaultVariants: {
    size: "md",
    variant: "outline",
  },
  variants: {
    size: {
      xs: {
        control: {
          "--stepper-width": "sizes.4.5",
        },
        input: input.variants.size.xs,
      },
      sm: {
        control: {
          "--stepper-width": "sizes.5",
        },
        input: input.variants.size.sm,
      },
      md: {
        control: {
          "--stepper-width": "sizes.5",
        },
        input: input.variants.size.md,
      },
      lg: {
        control: {
          "--stepper-width": "sizes.6.5",
        },
        input: input.variants.size.lg,
      },
      xl: {
        control: {
          "--stepper-width": "sizes.7",
        },
        input: input.variants.size.xl,
      },
    },
    variant: {
      outline: {
        input: input.variants.variant.outline,
      },
      surface: {
        input: input.variants.variant.surface,
      },
    },
  },
})
