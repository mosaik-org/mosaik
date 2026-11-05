import { Checkbox } from "@mosaik/mosaik-ui"
import PlusIcon from "lucide-solid/icons/plus"

export const App = () => {
  return (
    <Checkbox.Root>
      <Checkbox.HiddenInput />
      <Checkbox.Control>
        <Checkbox.Indicator>
          <PlusIcon />
        </Checkbox.Indicator>
      </Checkbox.Control>
      <Checkbox.Label>Label</Checkbox.Label>
    </Checkbox.Root>
  )
}
