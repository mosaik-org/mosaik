import { Slider } from "@mosaik/mosaik-ui"
import { For } from "solid-js"
import { Stack } from "styled-system/jsx"

const states = [
  { label: "Disabled", props: { disabled: true } },
  { label: "Invalid", props: { invalid: true } },
  { label: "Read only", props: { readOnly: true } },
] as const

export const App = () => (
  <Stack gap="4" width="sm">
    <For each={states}>
      {(state) => (
        <Slider.Root defaultValue={[40]} {...state.props}>
          <Slider.Label>{state.label}</Slider.Label>
          <Slider.Control>
            <Slider.Track>
              <Slider.Range />
            </Slider.Track>
            <Slider.Thumbs />
          </Slider.Control>
        </Slider.Root>
      )}
    </For>
  </Stack>
)
