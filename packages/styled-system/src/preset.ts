import { definePreset } from "@pandacss/dev"

/**
 * Mosaik design system preset: tokens, semantic (light/dark) tokens and global styles.
 * Component styles live next to their components in `@mosaik/ui` (via `cva` / `sva`).
 */
export const mosaikPreset = definePreset({
  name: "mosaik",
  conditions: {
    extend: {
      dark: ".dark &, .dark",
      light: ":root:not(.dark) &",
    },
  },
  globalCss: {
    extend: {
      "html, body": {
        bg: "bg.canvas",
        color: "fg.default",
        fontFamily: "body",
        fontSize: "sm",
        lineHeight: "1.5",
        WebkitFontSmoothing: "antialiased",
        colorScheme: "light",
        _dark: { colorScheme: "dark" },
      },
      "*, *::before, *::after": {
        borderColor: "border.default",
      },
      "::selection": {
        bg: "accent.subtle",
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
      semanticTokens: {
        colors: {
          bg: {
            canvas: { value: { base: "{colors.white}", _dark: "{colors.neutral.950}" } },
            surface: { value: { base: "{colors.white}", _dark: "{colors.neutral.900}" } },
            subtle: { value: { base: "{colors.neutral.50}", _dark: "{colors.neutral.900}" } },
            muted: { value: { base: "{colors.neutral.100}", _dark: "{colors.neutral.800}" } },
            emphasized: { value: { base: "{colors.neutral.200}", _dark: "{colors.neutral.700}" } },
            overlay: { value: { base: "{colors.black/40}", _dark: "{colors.black/60}" } },
          },
          fg: {
            default: { value: { base: "{colors.neutral.900}", _dark: "{colors.neutral.50}" } },
            muted: { value: { base: "{colors.neutral.600}", _dark: "{colors.neutral.400}" } },
            subtle: { value: { base: "{colors.neutral.500}", _dark: "{colors.neutral.500}" } },
            inverted: { value: { base: "{colors.white}", _dark: "{colors.neutral.950}" } },
          },
          border: {
            default: { value: { base: "{colors.neutral.200}", _dark: "{colors.neutral.800}" } },
            emphasized: { value: { base: "{colors.neutral.300}", _dark: "{colors.neutral.700}" } },
          },
          accent: {
            default: { value: { base: "{colors.indigo.600}", _dark: "{colors.indigo.500}" } },
            emphasized: { value: { base: "{colors.indigo.700}", _dark: "{colors.indigo.400}" } },
            fg: { value: { base: "{colors.white}", _dark: "{colors.white}" } },
            text: { value: { base: "{colors.indigo.700}", _dark: "{colors.indigo.300}" } },
            subtle: { value: { base: "{colors.indigo.50}", _dark: "{colors.indigo.950}" } },
          },
          danger: {
            default: { value: { base: "{colors.red.600}", _dark: "{colors.red.500}" } },
            emphasized: { value: { base: "{colors.red.700}", _dark: "{colors.red.400}" } },
            text: { value: { base: "{colors.red.700}", _dark: "{colors.red.300}" } },
            subtle: { value: { base: "{colors.red.50}", _dark: "{colors.red.950}" } },
          },
          success: {
            default: { value: { base: "{colors.green.600}", _dark: "{colors.green.500}" } },
            text: { value: { base: "{colors.green.700}", _dark: "{colors.green.300}" } },
            subtle: { value: { base: "{colors.green.50}", _dark: "{colors.green.950}" } },
          },
          warning: {
            default: { value: { base: "{colors.amber.500}", _dark: "{colors.amber.400}" } },
            text: { value: { base: "{colors.amber.700}", _dark: "{colors.amber.300}" } },
            subtle: { value: { base: "{colors.amber.50}", _dark: "{colors.amber.950}" } },
          },
        },
        shadows: {
          card: {
            value: {
              base: "0 1px 2px 0 {colors.black/5}, 0 1px 3px 0 {colors.black/5}",
              _dark: "0 0 0 1px {colors.white/5}",
            },
          },
          popover: {
            value: {
              base: "0 10px 30px -10px {colors.black/25}, 0 0 0 1px {colors.black/5}",
              _dark: "0 10px 30px -10px {colors.black/80}, 0 0 0 1px {colors.white/10}",
            },
          },
        },
        radii: {
          control: { value: "{radii.md}" },
          card: { value: "{radii.lg}" },
        },
      },
      keyframes: {
        spin: { to: { transform: "rotate(360deg)" } },
        fadeIn: { from: { opacity: "0" }, to: { opacity: "1" } },
        fadeOut: { from: { opacity: "1" }, to: { opacity: "0" } },
        scaleIn: { from: { opacity: "0", transform: "scale(0.96)" }, to: { opacity: "1", transform: "scale(1)" } },
        scaleOut: { from: { opacity: "1", transform: "scale(1)" }, to: { opacity: "0", transform: "scale(0.96)" } },
        slideIn: { from: { opacity: "0", transform: "translateY(8px)" }, to: { opacity: "1", transform: "translateY(0)" } },
      },
    },
  },
})
