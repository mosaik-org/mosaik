import { Checkbox, Text } from "@mosaik/mosaik-ui"
import { createSignal, For } from "solid-js"
import { Stack } from "styled-system/jsx"

const items = [
  { label: "React", value: "react" },
  { label: "Solid", value: "solid" },
  { label: "Vue", value: "vue" },
]

export const App = () => {
  const [value, setValue] = createSignal(["solid"])

  return (
    <Stack gap="3">
      <Checkbox.Group value={value} onValueChange={setValue} name="frameworks">
        <For each={items}>
          {(item) => (
            <Checkbox.Root value={item.value}>
              <Checkbox.HiddenInput />
              <Checkbox.Control>
                <Checkbox.Indicator />
              </Checkbox.Control>
              <Checkbox.Label>{item.label}</Checkbox.Label>
            </Checkbox.Root>
          )}
        </For>
      </Checkbox.Group>
      <Text textStyle="sm">Chosen: {value().join(", ")}</Text>
    </Stack>
  )
}
