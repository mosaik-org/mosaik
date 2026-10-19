import { NumberInput } from "@mosaik/mosaik-ui"

export const App = () => {
  return (
    <NumberInput.Root defaultValue="2" step={3}>
      <NumberInput.Control />
      <NumberInput.Input aria-label="Quantity" />
    </NumberInput.Root>
  )
}
