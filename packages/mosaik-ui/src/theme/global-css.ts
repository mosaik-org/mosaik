import { defineGlobalStyles, type Preset } from "@pandacss/dev"

/** Page defaults: the accent as the inherited color palette, the canvas and text colors. */
export const globalCss: NonNullable<Preset["globalCss"]> = defineGlobalStyles({
  "*": {
    "--global-color-border": "colors.border",
    "--global-color-placeholder": "colors.fg.subtle",
    "--global-color-selection": "colors.colorPalette.subtle.bg",
    "--global-color-focus-ring": "colors.colorPalette.solid.bg",
  },
  html: {
    colorPalette: "accent",
  },
  body: {
    background: "canvas",
    color: "fg.default",
  },
})
