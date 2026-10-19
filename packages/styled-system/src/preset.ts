import { definePreset } from "@pandacss/dev"
import { createPreset } from "@mosaik/mosaik-ui/preset"

/**
 * Mosaik's theme for `@mosaik/mosaik-ui`: indigo for the accent, neutral grays, medium corners.
 * Builds that make the kit's stylesheet (the shell, the console, this package) compile every recipe;
 * `mosaikTokensPreset` is the same theme without them, for apps' own styles.
 */
const theme = { accent: "indigo", gray: "neutral", danger: "red", success: "green", warning: "amber", radius: "md" } as const

export const mosaikUiPreset = createPreset(theme)

/** The theme's tokens and recipes without compiling them: for a build that styles only its own code. */
export const mosaikTokensPreset = createPreset({ ...theme, staticCss: false })

/** What Mosaik adds to the library's theme: its fonts and base text size. */
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
          body: { value: "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif" },
          mono: { value: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace" },
        },
      },
    },
  },
})
