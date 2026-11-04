import { definePreset } from "@pandacss/dev"
import { createPreset } from "@mosaik/mosaik-ui/preset"

/**
 * Mosaik's theme for `@mosaik/mosaik-ui`: indigo for the accent, cool (slate) grays, medium corners.
 * Builds that make the kit's stylesheet (the shell, the console, this package) compile every recipe;
 * `mosaikTokensPreset` is the same theme without them, for apps' own styles.
 */
const theme = { accent: "indigo", gray: "slate", danger: "red", success: "green", warning: "amber", radius: "md" } as const

export const mosaikUiPreset = createPreset(theme)

/** The theme's tokens and recipes without compiling them: for a build that styles only its own code. */
export const mosaikTokensPreset = createPreset({ ...theme, staticCss: false })

/**
 * What Mosaik adds to the library's theme: its fonts (Geist, loaded by `fonts.css`), base text size,
 * and the colors of charts' series (`chart.1`…`chart.6`, in order), on the theme's palettes so dark
 * mode and a theme reach them.
 */
export const mosaikPreset = definePreset({
  name: "mosaik",
  globalCss: {
    extend: {
      "html, body": {
        fontFamily: "body",
        fontSize: "sm",
        lineHeight: "1.5",
        WebkitFontSmoothing: "antialiased",
        colorScheme: "light",
        _dark: { colorScheme: "dark" },
      },
    },
  },
  theme: {
    extend: {
      tokens: {
        fonts: {
          body: { value: "'Geist Variable', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif" },
          mono: { value: "'Geist Mono Variable', ui-monospace, SFMono-Regular, Menlo, monospace" },
        },
      },
      semanticTokens: {
        colors: {
          // The accent first: a chart with one series is in the theme's color.
          chart: Object.fromEntries(
            ["accent", "green", "amber", "red", "teal", "violet"].map((palette, index) => [
              index + 1,
              { value: `{colors.${palette}.9}` },
            ]),
          ),
        },
      },
    },
  },
})
