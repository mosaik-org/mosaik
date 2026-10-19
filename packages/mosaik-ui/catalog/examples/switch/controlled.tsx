import { Switch } from "@mosaik/mosaik-ui"
import { createSignal } from "solid-js"

export const App = () => {
  const [checked, setChecked] = createSignal(false)
  return (
    <Switch.Root checked={checked()} onCheckedChange={(e) => setChecked(e.checked)}>
      <Switch.Control>
        <Switch.Thumb />
      </Switch.Control>
      <Switch.Label>Label</Switch.Label>
      <Switch.HiddenInput />
    </Switch.Root>
  )
}
