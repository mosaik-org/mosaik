import { Stat } from "@mosaik/mosaik-ui"
import { stat } from "styled-system/recipes"
import { Showcase } from "../../showcase"

export const App = () => (
  <Showcase values={stat.variantMap.direction}>
    {(direction) => (
      <Stat label="Revenue" value="€48,210" trend={{ value: "12%", direction: direction as "up" | "down" | "flat" }} />
    )}
  </Showcase>
)
