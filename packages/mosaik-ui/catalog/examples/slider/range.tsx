import { Slider } from "@mosaik/mosaik-ui"

export const App = () => (
  <Slider.Root defaultValue={[25, 75]} maxW="sm">
    <Slider.Label>Price</Slider.Label>
    <Slider.Control>
      <Slider.Track>
        <Slider.Range />
      </Slider.Track>
      <Slider.Thumbs />
    </Slider.Control>
  </Slider.Root>
)
