import { Switch, Tooltip } from "@mosaik/mosaik-ui"
import { createUniqueId } from "solid-js"

export const App = () => {
  const id = createUniqueId()
  return (
    <Tooltip ids={{ trigger: id }} content="This is a tooltip">
      <Switch.Root ids={{ root: id }}>
        <Switch.HiddenInput />
        <Switch.Control />
        <Switch.Label>Switch with tooltip</Switch.Label>
      </Switch.Root>
    </Tooltip>
  )
}
