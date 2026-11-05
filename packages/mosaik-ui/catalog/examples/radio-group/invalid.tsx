import { RadioGroup } from "@mosaik/mosaik-ui"
import { For } from "solid-js"

const items = [
  { label: "React", value: "react" },
  { label: "Solid", value: "solid" },
  { label: "Vue", value: "vue" },
]

export const App = () => (
  <RadioGroup.Root invalid aria-label="Framework">
    <For each={items}>
      {(item) => (
        <RadioGroup.Item value={item.value}>
          <RadioGroup.ItemHiddenInput />
          <RadioGroup.ItemControl />
          <RadioGroup.ItemText>{item.label}</RadioGroup.ItemText>
        </RadioGroup.Item>
      )}
    </For>
  </RadioGroup.Root>
)
