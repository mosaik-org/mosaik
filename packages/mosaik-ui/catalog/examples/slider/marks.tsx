import { Slider } from "@mosaik/mosaik-ui"

const marks = [
  { value: 0, label: "0%" },
  { value: 50, label: "50%" },
  { value: 100, label: "100%" },
]

export const App = () => (
  <Slider.Root width="sm" defaultValue={[50]} pb="6">
    <Slider.Label>Volume</Slider.Label>
    <Slider.Control>
      <Slider.Track>
        <Slider.Range />
      </Slider.Track>
      <Slider.Thumbs />
      <Slider.Marks marks={marks} />
    </Slider.Control>
  </Slider.Root>
)
