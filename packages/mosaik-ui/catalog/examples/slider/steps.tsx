import { Slider } from "@mosaik/mosaik-ui"

// Moves ten at a time, by pointer or arrow key.
export const App = () => (
  <Slider.Root width="sm" defaultValue={[40]} step={10}>
    <Slider.Label>Volume</Slider.Label>
    <Slider.Control>
      <Slider.Track>
        <Slider.Range />
      </Slider.Track>
      <Slider.Thumbs />
    </Slider.Control>
  </Slider.Root>
)
