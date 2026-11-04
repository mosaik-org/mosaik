import { defineSlotRecipe } from "@pandacss/dev"

export const card = defineSlotRecipe({
  className: "card",
  slots: ["root", "header", "body", "footer", "title", "description"],
  base: {
    root: {
      borderRadius: "l3",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      position: "relative",
    },
    header: {
      display: "flex",
      flexDirection: "column",
      gap: "1",
      p: "5",
    },
    body: {
      display: "flex",
      flex: "1",
      flexDirection: "column",
      pb: "5",
      px: "5",
      // Without a header above it, the body pads its own top.
      "&:first-child": { pt: "5" },
    },
    footer: {
      display: "flex",
      justifyContent: "flex-end",
      gap: "3",
      pb: "5",
      pt: "2",
      px: "5",
    },
    title: {
      textStyle: "md",
      fontWeight: "semibold",
    },
    description: {
      color: "fg.muted",
      textStyle: "sm",
    },
  },
  defaultVariants: {
    variant: "outline",
  },
  variants: {
    variant: {
      elevated: {
        root: {
          bg: "gray.surface.bg",
          boxShadow: "lg",
        },
      },
      outline: {
        root: {
          bg: "gray.surface.bg",
          borderWidth: "1px",
          boxShadow: "xs",
        },
      },
      subtle: {
        root: {
          bg: "gray.subtle.bg",
        },
      },
    },
  },
})
