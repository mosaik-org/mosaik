import { Button, Slider } from "@mosaik/mosaik-ui"
import { Stack } from "styled-system/jsx"

export const App = () => {
  const slider = Slider.useSlider({ defaultValue: [40] })

  return (
    <Stack gap="3" alignItems="start" width="sm">
      <Button variant="outline" onClick={() => slider().setValue([80])}>
        Set to 80
      </Button>
      <Slider.RootProvider value={slider}>
        <Slider.Label>Volume</Slider.Label>
        <Slider.Control>
          <Slider.Track>
            <Slider.Range />
          </Slider.Track>
          <Slider.Thumbs />
        </Slider.Control>
      </Slider.RootProvider>
    </Stack>
  )
}
