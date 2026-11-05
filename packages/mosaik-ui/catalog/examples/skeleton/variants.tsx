import { Skeleton } from "@mosaik/mosaik-ui"
import { skeleton } from "styled-system/recipes"
import { Showcase } from "../../showcase"

export const App = () => (
  <Showcase values={skeleton.variantMap.variant} wide>
    {(variant) => <Skeleton minH="5" variant={variant} />}
  </Showcase>
)
