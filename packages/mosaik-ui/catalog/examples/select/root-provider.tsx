import { Button, createListCollection, Select } from "@mosaik/mosaik-ui"
import { For } from "solid-js"
import { Portal } from "solid-js/web"
import { Stack } from "styled-system/jsx"

const collection = createListCollection({
  items: [
    { label: "React", value: "react" },
    { label: "Solid", value: "solid" },
    { label: "Vue", value: "vue" },
  ],
})

export const App = () => {
  const select = Select.useSelect({ collection })

  return (
    <Stack gap="3" alignItems="start" width="xs">
      <Button variant="outline" onClick={() => select().setValue(["solid"])}>
        Choose Solid
      </Button>
      <Select.RootProvider value={select}>
        <Select.Label>Framework</Select.Label>
        <Select.Control>
          <Select.Trigger>
            <Select.ValueText placeholder="Choose one" />
          </Select.Trigger>
          <Select.IndicatorGroup>
            <Select.Indicator />
          </Select.IndicatorGroup>
        </Select.Control>
        <Portal>
          <Select.Positioner>
            <Select.Content>
              <For each={collection.items}>
                {(item) => (
                  <Select.Item item={item}>
                    <Select.ItemText>{item.label}</Select.ItemText>
                    <Select.ItemIndicator />
                  </Select.Item>
                )}
              </For>
            </Select.Content>
          </Select.Positioner>
        </Portal>
      </Select.RootProvider>
    </Stack>
  )
}
