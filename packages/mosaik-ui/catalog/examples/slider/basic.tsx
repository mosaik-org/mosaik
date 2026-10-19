import { Slider } from "@mosaik/mosaik-ui"

export const App = () => {
  return (
    <Slider.Root width="sm" defaultValue={[40]}>
      <Slider.Label>Volume</Slider.Label>
      <Slider.Control>
        <Slider.Track>
          <Slider.Range />
        </Slider.Track>
        <Slider.Thumbs />
      </Slider.Control>
    </Slider.Root>
  )
}
