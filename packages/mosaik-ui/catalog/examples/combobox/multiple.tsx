import { Badge, Combobox, useFilter, useListCollection } from "@mosaik/mosaik-ui"
import { createSignal, For } from "solid-js"
import { Portal } from "solid-js/web"
import { Stack, Wrap } from "styled-system/jsx"

export const App = () => {
  const filters = useFilter({ sensitivity: "base" })
  const { collection, filter } = useListCollection({ initialItems: frameworks, filter: filters().contains })
  const [value, setValue] = createSignal<string[]>(["solid"])

  return (
    <Stack gap="3">
      <Wrap gap="1">
        <For each={value()}>{(chosen) => <Badge>{chosen}</Badge>}</For>
      </Wrap>
      <Combobox.Root
        collection={collection()}
        multiple
        value={value()}
        onValueChange={(event) => setValue(event.value)}
        onInputValueChange={(event) => filter(event.inputValue)}
      >
        <Combobox.Label>Framework</Combobox.Label>
        <Combobox.Control>
          <Combobox.Input placeholder="Type to search" />
          <Combobox.IndicatorGroup>
            <Combobox.ClearTrigger />
            <Combobox.Trigger />
          </Combobox.IndicatorGroup>
        </Combobox.Control>
        <Portal>
          <Combobox.Positioner>
            <Combobox.Content>
              <Combobox.Empty>No items found</Combobox.Empty>
              <For each={collection().items}>
                {(item) => (
                  <Combobox.Item item={item}>
                    {item.label}
                    <Combobox.ItemIndicator />
                  </Combobox.Item>
                )}
              </For>
            </Combobox.Content>
          </Combobox.Positioner>
        </Portal>
      </Combobox.Root>
    </Stack>
  )
}

const frameworks = [
  { label: "React", value: "react" },
  { label: "Solid", value: "solid" },
  { label: "Vue", value: "vue" },
  { label: "Svelte", value: "svelte" },
  { label: "Angular", value: "angular", disabled: true },
]
