import { defineGlobalStyles, type Preset } from "@pandacss/dev"

/**
 * Page defaults: grey as the inherited color palette, the canvas and text colors. Grey unless
 * something asks: the accent marks what acts (a primary button, a link) and what the person set
 * (a checked box, a chosen day, a focused field), each recipe asking for it, so on a screen it
 * stays rare enough to mean something.
 */
export const globalCss: NonNullable<Preset["globalCss"]> = defineGlobalStyles({
  "*": {
    "--global-color-border": "colors.border",
    "--global-color-placeholder": "colors.fg.subtle",
    "--global-color-selection": "colors.accent.subtle.bg",
    // The accent whatever the control's palette: one colour to look for, and a grey button's
    // solid colour (black or white) would make a halo hardly seen. An invalid field's is the error's.
    "--global-color-focus-ring": "colors.accent.solid.bg",
    // Hover and colour changes (`transition`) move like the rest.
    "--transition-easing": "easings.standard",
  },
  html: {
    colorPalette: "gray",
  },
  // When the system asks for less motion, what slides or zooms in only fades: the keyframes scale
  // their distances by `--motion`.
  "@media (prefers-reduced-motion: reduce)": {
    ":root": { "--motion": "0" },
  },
  body: {
    background: "canvas",
    color: "fg.default",
  },
})
