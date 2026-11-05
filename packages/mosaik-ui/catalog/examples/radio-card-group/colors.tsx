import { RadioCardGroup } from "@mosaik/mosaik-ui"
import { COLORS, Showcase } from "../../showcase"

export const App = () => (
  <Showcase values={COLORS}>
    {(color) => (
      <RadioCardGroup.Root defaultValue="on" colorPalette={color} aria-label={color}>
        <RadioCardGroup.Item value="on">
          <RadioCardGroup.ItemHiddenInput />
          <RadioCardGroup.ItemText>{color}</RadioCardGroup.ItemText>
          <RadioCardGroup.ItemControl />
        </RadioCardGroup.Item>
      </RadioCardGroup.Root>
    )}
  </Showcase>
)
