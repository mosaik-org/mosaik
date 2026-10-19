import { Checkbox } from "@mosaik/mosaik-ui"

export const App = () => {
  return (
    <Checkbox.Root defaultChecked>
      <Checkbox.HiddenInput />
      <Checkbox.Control>
        <Checkbox.Indicator />
      </Checkbox.Control>
      <Checkbox.Label>Label</Checkbox.Label>
    </Checkbox.Root>
  )
}
