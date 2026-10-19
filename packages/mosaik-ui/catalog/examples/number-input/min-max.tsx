import { NumberInput } from "@mosaik/mosaik-ui"

export const App = () => {
  return (
    <NumberInput.Root defaultValue="42" min={5} max={50}>
      <NumberInput.Control />
      <NumberInput.Input aria-label="Quantity" />
    </NumberInput.Root>
  )
}
