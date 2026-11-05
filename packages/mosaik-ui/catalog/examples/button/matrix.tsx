import { Button } from "@mosaik/mosaik-ui"
import { button } from "styled-system/recipes"
import { COLORS, Matrix } from "../../showcase"

/** Every variant in every color. */
export const App = () => (
  <Matrix rows={button.variantMap.variant} columns={COLORS}>
    {(variant, color) => (
      <Button size="sm" variant={variant} colorPalette={color}>
        Button
      </Button>
    )}
  </Matrix>
)
