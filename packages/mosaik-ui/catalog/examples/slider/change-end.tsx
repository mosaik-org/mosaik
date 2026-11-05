import { Slider, Text } from "@mosaik/mosaik-ui"
import { createSignal } from "solid-js"
import { Stack } from "styled-system/jsx"

// `onValueChange` runs at every step of a drag; save in `onValueChangeEnd`, when it stops.
export const App = () => {
  const [saved, setSaved] = createSignal(40)

  return (
    <Stack gap="2" width="sm">
      <Slider.Root defaultValue={[40]} onValueChangeEnd={(event) => setSaved(event.value[0] ?? 0)}>
        <Slider.Label>Volume</Slider.Label>
        <Slider.Control>
          <Slider.Track>
            <Slider.Range />
          </Slider.Track>
          <Slider.Thumbs />
        </Slider.Control>
      </Slider.Root>
      <Text textStyle="sm">Saved: {saved()}</Text>
    </Stack>
  )
}
