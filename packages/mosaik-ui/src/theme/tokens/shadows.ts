import { defineSemanticTokens } from "@pandacss/dev"

/**
 * Elevation, `xs` to `2xl`: a short shadow close to the surface and a long, faint one below it, as
 * light falls, with a fine edge from `sm` up so a surface keeps its outline on any background. In
 * dark mode, where shadows hardly show, the edge is light (and raised surfaces are lighter: the gray
 * palette's `surface`).
 */
const LIGHT_EDGE = "0 0 0 1px rgb(0 0 0 / 0.05)"
const DARK_EDGE = "inset 0 0 0 1px rgb(255 255 255 / 0.07)"

const elevation = (near: string, far: string, edge = true) => ({
  value: {
    _light: [`${near} rgb(0 0 0 / 0.05)`, `${far} rgb(0 0 0 / 0.1)`, ...(edge ? [LIGHT_EDGE] : [])].join(", "),
    _dark: [`${near} rgb(0 0 0 / 0.4)`, `${far} rgb(0 0 0 / 0.5)`, ...(edge ? [DARK_EDGE] : [])].join(", "),
  },
})

export const shadows = defineSemanticTokens.shadows({
  xs: elevation("0 1px 1px", "0 1px 3px", false),
  sm: elevation("0 1px 2px", "0 2px 6px -1px"),
  md: elevation("0 2px 4px -1px", "0 6px 16px -4px"),
  lg: elevation("0 4px 8px -2px", "0 12px 28px -6px"),
  xl: elevation("0 8px 16px -4px", "0 20px 44px -8px"),
  "2xl": elevation("0 12px 24px -6px", "0 32px 64px -12px"),
  /** A solid button's: lit along its top edge, resting on the surface. */
  raised: {
    value: {
      _light: "inset 0 1px 0 rgb(255 255 255 / 0.18), 0 1px 2px rgb(0 0 0 / 0.14)",
      _dark: "inset 0 1px 0 rgb(255 255 255 / 0.16), 0 1px 2px rgb(0 0 0 / 0.5)",
    },
  },
  inset: {
    value: {
      _light: "inset 8px 0 12px -8px {colors.gray.a4}",
      _dark: "inset 8px 0 12px -8px {colors.black.a6}",
    },
  },
})
