import { Checkbox } from "@mosaik/mosaik-ui"
import { For } from "solid-js"
import { Stack } from "styled-system/jsx"

export const App = () => {
  const sizes = ["sm", "md", "lg"] as const
  return (
    <Stack gap="4" alignItems="start">
      <For each={sizes}>
        {(size) => (
          <Checkbox.Root size={size} defaultChecked>
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
