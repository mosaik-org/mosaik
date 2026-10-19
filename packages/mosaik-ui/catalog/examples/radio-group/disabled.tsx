import { RadioGroup } from "@mosaik/mosaik-ui"
import { For } from "solid-js"

export const App = () => {
  return (
    <RadioGroup.Root defaultValue="react">
      <For each={items}>
        {(item) => (
          <RadioGroup.Item value={item.value} disabled={item.disabled}>
            <RadioGroup.ItemHiddenInput />
            <RadioGroup.ItemControl />
            <RadioGroup.ItemText>{item.label}</RadioGroup.ItemText>
          </RadioGroup.Item>
        )}
      </For>
    </RadioGroup.Root>
  )
}

const items = [
  { label: "React", value: "react" },
  { label: "Solid", value: "solid" },
  { label: "Vue", value: "vue" },
  { label: "Svelte", value: "svelte", disabled: true },
]
