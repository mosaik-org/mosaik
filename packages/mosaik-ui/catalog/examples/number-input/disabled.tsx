import { NumberInput } from "@mosaik/mosaik-ui"

export const App = () => {
  return (
    <NumberInput.Root defaultValue="42" disabled>
      <NumberInput.Control />
      <NumberInput.Input aria-label="Quantity" />
    </NumberInput.Root>
  )
}
