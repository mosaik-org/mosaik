import { NumberInput } from "@mosaik/mosaik-ui"
import { For } from "solid-js"
import { Stack } from "styled-system/jsx"

export const App = () => {
  const sizes = ["xs", "sm", "md", "lg", "xl"] as const
  return (
    <Stack gap="4">
      <For each={sizes}>
        {(size) => (
          <NumberInput.Root size={size} defaultValue="42">
            <NumberInput.Control />
            <NumberInput.Input aria-label="Quantity" />
          </NumberInput.Root>
        )}
      </For>
    </Stack>
  )
}
