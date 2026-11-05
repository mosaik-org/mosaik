import { Badge } from "@mosaik/mosaik-ui"
import { badge } from "styled-system/recipes"
import { COLORS, Matrix } from "../../showcase"

/** Every variant in every color. */
export const App = () => (
  <Matrix rows={badge.variantMap.variant} columns={COLORS}>
    {(variant, color) => (
      <Badge variant={variant} colorPalette={color}>
        Badge
      </Badge>
    )}
  </Matrix>
)
