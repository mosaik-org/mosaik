import { Switch } from "@mosaik/mosaik-ui"

export const App = () => {
  return (
    <Switch.Root invalid>
      <Switch.Control>
        <Switch.Thumb />
      </Switch.Control>
      <Switch.Label>Label</Switch.Label>
      <Switch.HiddenInput />
    </Switch.Root>
  )
}
