import { InputGroup, NumberInput } from "@mosaik/mosaik-ui"
import { ArrowLeftRightIcon } from "lucide-solid"

export const App = () => {
  return (
    <NumberInput.Root defaultValue="42">
      <NumberInput.Control />
      <InputGroup
        startElement={
          <NumberInput.Scrubber pointerEvents="auto">
            <ArrowLeftRightIcon />
          </NumberInput.Scrubber>
        }
      >
        <NumberInput.Input aria-label="Quantity" />
      </InputGroup>
    </NumberInput.Root>
  )
}
