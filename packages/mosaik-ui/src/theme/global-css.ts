import { defineGlobalStyles, type Preset } from "@pandacss/dev"

/** Page defaults: the accent as the inherited color palette, the canvas and text colors. */
export const globalCss: NonNullable<Preset["globalCss"]> = defineGlobalStyles({
  "*": {
    "--global-color-border": "colors.border",
    "--global-color-placeholder": "colors.fg.subtle",
    "--global-color-selection": "colors.colorPalette.subtle.bg",
    // The accent whatever the control's palette: one colour to look for, and a grey button's
    // solid colour (black or white) would make a halo hardly seen. An invalid field's is the error's.
    "--global-color-focus-ring": "colors.accent.solid.bg",
  },
  html: {
    colorPalette: "accent",
  },
  body: {
    background: "canvas",
    color: "fg.default",
  },
})
