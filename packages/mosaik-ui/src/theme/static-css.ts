import type { Preset } from "@pandacss/dev"
import { palettes } from "./colors"

const roles = ["accent", "gray", "danger", "success", "warning"]

/**
 * What the library's stylesheet holds without anyone scanning its components: every recipe and
 * variant, every palette and role as a `colorPalette`, and the few atomic styles the components
 * set inline (`px="0"` on `IconButton`, the `Stack`s of `Toast`, ...). With it in the preset, any
 * Panda build with the preset reproduces the stylesheet; `test/stylesheet.server.test.ts` fails
 * when a component starts using an atomic style missing here.
 */
export const staticCss: NonNullable<Preset["staticCss"]> = {
  recipes: "*",
  css: [
    { properties: { colorPalette: [...Object.keys(palettes), ...roles] } },
    {
      properties: {
        alignItems: ["center", "start"],
        borderWidth: ["0.125em"],
        color: ["colorPalette.plain.fg", "fg.subtle", "inherit"],
        display: ["contents", "flex", "grid", "inline-flex"],
        fill: ["none"],
        flex: ["1"],
        flexDirection: ["column", "row"],
        gap: ["0.5", "1", "2", "3", "8px"],
        height: ["4", "8"],
        insetInlineEnd: ["0"],
        insetInlineStart: ["0"],
        justifyContent: ["space-between"],
        paddingInline: ["0", "2"],
        paddingBlock: ["0"],
        srOnly: ["true"],
        stroke: ["currentColor"],
        strokeLinecap: ["round"],
        strokeLinejoin: ["round"],
        strokeWidth: ["3px"],
        top: ["0"],
        visibility: ["hidden"],
        width: ["60%", "full"],
      },
    },
  ],
}
