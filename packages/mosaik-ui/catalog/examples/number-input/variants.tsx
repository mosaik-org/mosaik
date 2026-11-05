import { NumberInput } from "@mosaik/mosaik-ui"
import { numberInput } from "styled-system/recipes"
import { Showcase } from "../../showcase"

export const App = () => (
  <Showcase values={numberInput.variantMap.variant}>
    {(variant) => (
      <NumberInput.Root defaultValue="42" variant={variant}>
        <NumberInput.Control />
        <NumberInput.Input aria-label={`Quantity, ${variant}`} />
      </NumberInput.Root>
    )}
  </Showcase>
)
