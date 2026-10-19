import { Checkbox } from "@mosaik/mosaik-ui"

export const App = () => {
  return (
    <Checkbox.Root>
      <Checkbox.HiddenInput />
      <Checkbox.Label>Label</Checkbox.Label>
      <Checkbox.Control>
        <Checkbox.Indicator />
      </Checkbox.Control>
    </Checkbox.Root>
  )
}
