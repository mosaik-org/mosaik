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
import { staticCss } from "./static-css"
import { textStyles } from "./text-styles"
import { colors } from "./tokens/colors"
import { durations } from "./tokens/durations"
import { shadows } from "./tokens/shadows"
import { zIndex } from "./tokens/z-index"

export { alias, type PaletteName, palettes, type Roles, roleNames } from "./colors"

/**
 * The prefix of the library's class names and CSS variables (`mk-button`, `--mk-colors-...`). A
 * Panda build that compiles the library's styles from `createPreset` sets it too, so its CSS
 * matches the class names the components write.
 */
export const prefix = "mk"

/**
 * The corner radius of controls (`l2`: buttons, inputs). Parts inside them (`l1`) are a step
 * smaller; containers (`l3`: cards, dialogs, menus, alerts) two steps larger, so what holds controls
 * reads as a surface of its own. `md` by default: 4 px, 6 px and 12 px.
 */
export type Radius = "none" | "xs" | "sm" | "md" | "lg" | "xl" | "2xl"

const RADII: ReadonlyArray<Radius> = ["none", "xs", "sm", "md", "lg", "xl", "2xl"]

export interface ThemeOptions extends Partial<Roles> {
  readonly radius?: Radius
  /**
   * Compile every recipe, palette and the components' own styles, used or not (the default): a
   * build that makes the library's stylesheet. `false` for a build that styles only its own code,
   * on a page that loads the library's stylesheet already.
   */
  readonly staticCss?: boolean
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
  const { radius: _radius, staticCss: _static, ...chosen } = options
  const roles = { ...defaultRoles, ...chosen }
  const radius = RADII.indexOf(options.radius ?? "md")
  const radiusAt = (offset: number) => `{radii.${RADII[Math.max(0, Math.min(RADII.length - 1, radius + offset))]}}`
  return definePreset({
    name: "@mosaik/mosaik-ui",
    presets: [basePreset, scales],
    globalCss,
    conditions,
    staticCss: options.staticCss === false ? {} : staticCss,
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
          radii: { l1: { value: radiusAt(-1) }, l2: { value: radiusAt(0) }, l3: { value: radiusAt(2) } },
        },
      },
    },
  })
}

export const preset: Preset = createPreset()
