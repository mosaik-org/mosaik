/**
 * Keyboard focus as a halo: a 3px ring in the focus colour, translucent, hugging the element (and
 * following its corners), rather than Panda's solid outline set 2px away. Fields keep their border
 * in the focus colour inside it. It replaces `focusRing` and `focusVisibleRing`, so every recipe
 * gets it with the values it already uses: `outside` (buttons, links), `inside` (fields).
 */
import { defineUtility } from "@pandacss/dev"
import type { NestedCssProperties, PropertyTransform } from "@pandacss/types"

const HALO = "color-mix(in srgb, var(--focus-ring-color), transparent 50%)"

const halo = (selector: `&${string}`, className: string) =>
  defineUtility({
    className,
    group: "Focus Ring",
    values: ["outside", "inside", "mixed", "none"],
    transform: ((value: string) => {
      const styles: NestedCssProperties = {
        "--focus-ring-color": "var(--focus-ring-color-prop, var(--global-color-focus-ring, #005FCC))",
      }
      const ring: NestedCssProperties = {
        outlineOffset: "var(--focus-ring-offset, 0px)",
        outlineWidth: "var(--focus-ring-width, 3px)",
        outlineStyle: "solid",
        outlineColor: HALO,
      }
      // A field shows where it is by its border too.
      if (value !== "outside") ring.borderColor = "var(--focus-ring-color)"
      styles[selector] = value === "none" ? { outline: "none" } : ring
      return styles
    }) satisfies PropertyTransform,
  })

export const focusRings = {
  focusRing: halo("&:is(:focus, [data-focus])", "focus-ring"),
  focusVisibleRing: halo("&:is(:focus-visible, [data-focus-visible])", "focus-v-ring"),
}
