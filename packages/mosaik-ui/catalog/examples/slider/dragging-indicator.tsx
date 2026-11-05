import { Slider } from "@mosaik/mosaik-ui"

export const App = () => (
  <Slider.Root width="sm" defaultValue={[40]} mt="6">
    <Slider.Label>Drag it</Slider.Label>
    <Slider.Control>
      <Slider.Track>
        <Slider.Range />
      </Slider.Track>
      <Slider.Thumb index={0}>
        <Slider.HiddenInput />
        <Slider.DraggingIndicator />
      </Slider.Thumb>
    </Slider.Control>
  </Slider.Root>
)
