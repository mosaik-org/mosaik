import { Checkbox } from "@mosaik/mosaik-ui"
import { COLORS, Showcase } from "../../showcase"

export const App = () => (
  <Showcase values={COLORS}>
    {(color) => (
      <Checkbox.Root colorPalette={color} defaultChecked>
        <Checkbox.HiddenInput />
        <Checkbox.Control>
          <Checkbox.Indicator />
        </Checkbox.Control>
        <Checkbox.Label>{color}</Checkbox.Label>
      </Checkbox.Root>
    )}
  </Showcase>
)
