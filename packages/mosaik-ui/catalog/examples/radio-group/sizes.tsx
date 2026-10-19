import { RadioGroup } from "@mosaik/mosaik-ui"
import { For } from "solid-js"
import { Wrap } from "styled-system/jsx"

export const App = () => {
  const sizes = ["sm", "md", "lg"] as const
  return (
    <Wrap gap="4">
      <For each={sizes}>
        {(size) => (
          <RadioGroup.Root size={size} defaultValue={size}>
            <RadioGroup.Item value={size}>
              <RadioGroup.ItemHiddenInput />
              <RadioGroup.ItemControl />
              <RadioGroup.ItemText>Radio ({size})</RadioGroup.ItemText>
            </RadioGroup.Item>
          </RadioGroup.Root>
        )}
      </For>
    </Wrap>
  )
}
