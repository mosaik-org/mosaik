import { NumberInput } from "@mosaik/mosaik-ui"
import { createSignal } from "solid-js"

export const App = () => {
  const [value, setValue] = createSignal("10")
  return (
    <NumberInput.Root value={value()} onValueChange={(e) => setValue(e.value)}>
      <NumberInput.Control />
      <NumberInput.Input aria-label="Quantity" />
    </NumberInput.Root>
  )
}
