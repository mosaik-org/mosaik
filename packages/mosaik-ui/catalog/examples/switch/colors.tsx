import { Switch } from "@mosaik/mosaik-ui"
import { COLORS, Showcase } from "../../showcase"

export const App = () => (
  <Showcase values={COLORS}>
    {(color) => (
      <Switch.Root colorPalette={color} defaultChecked>
        <Switch.Control>
          <Switch.Thumb />
        </Switch.Control>
        <Switch.Label>{color}</Switch.Label>
        <Switch.HiddenInput />
      </Switch.Root>
    )}
  </Showcase>
)
