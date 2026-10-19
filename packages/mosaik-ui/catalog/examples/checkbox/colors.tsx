import { Checkbox } from "@mosaik/mosaik-ui"
import { For } from "solid-js"
import { Stack } from "styled-system/jsx"

export const App = () => {
  const colors = ["blue", "green", "amber", "red"] as const

  return (
    <Stack gap="4" alignItems="start">
      <For each={colors}>
        {(color) => (
          <Checkbox.Root colorPalette={color} defaultChecked>
            <Checkbox.HiddenInput />
            <Checkbox.Control>
              <Checkbox.Indicator />
            </Checkbox.Control>
            <Checkbox.Label>Label</Checkbox.Label>
          </Checkbox.Root>
        )}
      </For>
    </Stack>
  )
}
