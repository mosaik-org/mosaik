import { Slider } from "@mosaik/mosaik-ui"
import { Flex } from "styled-system/jsx"

export const App = () => (
  <Slider.Root width="sm" defaultValue={[40]}>
    <Flex justify="space-between">
      <Slider.Label>Volume</Slider.Label>
      <Slider.ValueText />
    </Flex>
    <Slider.Control>
      <Slider.Track>
        <Slider.Range />
      </Slider.Track>
      <Slider.Thumbs />
    </Slider.Control>
  </Slider.Root>
)
