import { Button, Combobox, createListCollection } from "@mosaik/mosaik-ui"
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
  const combobox = Combobox.useCombobox({ collection })

  return (
    <Stack gap="3" alignItems="start">
      <Button variant="outline" onClick={() => combobox().setValue(["solid"])}>
        Choose Solid
      </Button>
      <Combobox.RootProvider value={combobox}>
        <Combobox.Label>Framework</Combobox.Label>
        <Combobox.Control>
          <Combobox.Input placeholder="Type to search" />
          <Combobox.IndicatorGroup>
            <Combobox.Trigger />
          </Combobox.IndicatorGroup>
        </Combobox.Control>
        <Portal>
          <Combobox.Positioner>
            <Combobox.Content>
              <For each={collection.items}>
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
      </Combobox.RootProvider>
    </Stack>
  )
}
