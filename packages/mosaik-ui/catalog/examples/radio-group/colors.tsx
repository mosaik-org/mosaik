import { RadioGroup } from "@mosaik/mosaik-ui"
import { COLORS, Showcase } from "../../showcase"

export const App = () => (
  <Showcase values={COLORS}>
    {(color) => (
      <RadioGroup.Root defaultValue="on" colorPalette={color} aria-label={color}>
        <RadioGroup.Item value="on">
          <RadioGroup.ItemHiddenInput />
          <RadioGroup.ItemControl />
          <RadioGroup.ItemText>{color}</RadioGroup.ItemText>
        </RadioGroup.Item>
      </RadioGroup.Root>
    )}
  </Showcase>
)
