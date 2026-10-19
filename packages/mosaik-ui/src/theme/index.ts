import { definePreset, type Preset } from "@pandacss/dev"
import { preset as basePreset } from "@pandacss/preset-base"
import { preset as pandaPreset } from "@pandacss/preset-panda"
import { animationStyles } from "./animation-styles"
import { alias, defaultRoles, type PaletteName, palettes, type Roles, roleNames } from "./colors"
import { conditions } from "./conditions"
import { globalCss } from "./global-css"
import { keyframes } from "./keyframes"
import { layerStyles } from "./layer-styles"
import { recipes, slotRecipes } from "./recipes"
import { textStyles } from "./text-styles"
import { colors } from "./tokens/colors"
import { durations } from "./tokens/durations"
import { shadows } from "./tokens/shadows"
import { zIndex } from "./tokens/z-index"

export { alias, type PaletteName, palettes, type Roles, roleNames } from "./colors"

/** The corner radius of controls (`l2`); smaller (`l1`) and larger (`l3`) parts follow one step away. */
export type Radius = "none" | "xs" | "sm" | "md" | "lg" | "xl"

const RADII: ReadonlyArray<Radius> = ["none", "xs", "sm", "md", "lg", "xl"]

export interface ThemeOptions extends Partial<Roles> {
  readonly radius?: Radius
}

/** Panda's default scales (spacing, sizes, fonts, ...) without its colors: the palettes replace them. */
const { colors: _pandaColors, ...pandaTokens } = pandaPreset.theme.tokens
const scales = { ...pandaPreset, theme: { ...pandaPreset.theme, tokens: pandaTokens } }

/**
 * The library's Panda preset: tokens, the palettes and their roles, conditions, global styles and
 * every component's recipe. Apps that use Panda get it through `designSystem: "@mosaik/mosaik-ui"`;
 * `createPreset` is for building a themed copy of the library's stylesheet.
 */
export const createPreset = (options: ThemeOptions = {}): Preset => {
  const roles = { ...defaultRoles, ...options }
  const radius = RADII.indexOf(options.radius ?? "sm")
  const radiusAt = (offset: number) => `{radii.${RADII[Math.max(0, Math.min(RADII.length - 1, radius + offset))]}}`
  return definePreset({
    name: "@mosaik/mosaik-ui",
    presets: [basePreset, scales],
    globalCss,
    conditions,
    theme: {
      extend: {
        animationStyles,
        recipes,
        slotRecipes,
        keyframes,
        layerStyles,
        textStyles,
        tokens: { colors, durations, zIndex },
        semanticTokens: {
          colors: {
            ...palettes,
            ...Object.fromEntries(roleNames.map((role) => [role, alias(roles[role] as PaletteName)])),
            fg: {
              default: { value: "{colors.gray.12}" },
              muted: { value: "{colors.gray.11}" },
              subtle: { value: "{colors.gray.10}" },
            },
            canvas: { value: "{colors.gray.1}" },
            border: { value: "{colors.gray.4}" },
            error: { value: "{colors.danger.9}" },
          },
          shadows,
          radii: { l1: { value: radiusAt(-1) }, l2: { value: radiusAt(0) }, l3: { value: radiusAt(1) } },
        },
      },
    },
  })
}

export const preset: Preset = createPreset()
