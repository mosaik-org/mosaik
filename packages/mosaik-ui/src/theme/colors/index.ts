import { amber } from "./amber"
import { blue } from "./blue"
import { green } from "./green"
import { indigo } from "./indigo"
import { neutral } from "./neutral"
import { orange } from "./orange"
import { pink } from "./pink"
import { red } from "./red"
import { teal } from "./teal"
import { violet } from "./violet"

/**
 * The palettes the library ships, each a 12-step scale (`1`–`12`, alpha `a1`–`a12`) plus the
 * colors every recipe variant reads (`solid.bg`, `subtle.fg`, `surface.border`, ...). Fewer than
 * Park UI's 31: each palette is about 60 CSS variables in light and dark, in every stylesheet.
 */
export const palettes = { amber, blue, green, indigo, neutral, orange, pink, red, teal, violet }

export type PaletteName = keyof typeof palettes

interface Token {
  readonly value: unknown
}
type Tree = { readonly [key: string]: Tree | Token }

const isToken = (node: Tree | Token): node is Token => "value" in node

/**
 * A palette that points at another one, token by token: `alias("indigo")` makes `accent.solid.bg`
 * `{colors.indigo.solid.bg}`. Recipes use the role (`colorPalette: "danger"`), and a theme picks
 * which palette plays it.
 */
export const alias = (target: PaletteName) => {
  const walk = (node: Tree, path: ReadonlyArray<string>): Tree =>
    Object.fromEntries(
      Object.entries(node).map(([key, child]) => {
        const at = key === "DEFAULT" ? path : [...path, key]
        return [key, isToken(child) ? { value: `{colors.${[target, ...at].join(".")}}` } : walk(child, at)]
      }),
    )
  return walk(palettes[target] as Tree, [])
}

/** Which palette plays each role. */
export interface Roles {
  /** Primary actions, focus rings, selection: the brand. */
  readonly accent: PaletteName
  /** Surfaces, borders and text. */
  readonly gray: PaletteName
  readonly danger: PaletteName
  readonly success: PaletteName
  readonly warning: PaletteName
}

export const defaultRoles: Roles = {
  accent: "indigo",
  gray: "neutral",
  danger: "red",
  success: "green",
  warning: "amber",
}

export const roleNames = ["accent", "gray", "danger", "success", "warning"] as const
