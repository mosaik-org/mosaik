import { InputGroup, NumberInput } from "@mosaik/mosaik-ui"
import { DollarSignIcon } from "lucide-solid"

export const App = () => {
  return (
    <NumberInput.Root defaultValue="42">
      <NumberInput.Control />
      <InputGroup startElement={<DollarSignIcon />}>
        <NumberInput.Input aria-label="Quantity" />
      </InputGroup>
    </NumberInput.Root>
  )
}
