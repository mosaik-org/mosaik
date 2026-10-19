import { Checkbox } from "@mosaik/mosaik-ui"
import { For } from "solid-js"
import { Stack } from "styled-system/jsx"

export const App = () => {
  const variants = ["solid", "surface", "subtle", "outline", "plain"] as const
  return (
    <Stack gap="4" alignItems="start">
      <For each={variants}>
        {(variant) => (
          <Checkbox.Root variant={variant} defaultChecked>
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
