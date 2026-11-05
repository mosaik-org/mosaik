import { Combobox, useFilter, useListCollection } from "@mosaik/mosaik-ui"
import { For } from "solid-js"
import { Portal } from "solid-js/web"

const fruits = [
  { label: "Apple", value: "apple", group: "Fruit" },
  { label: "Pear", value: "pear", group: "Fruit" },
  { label: "Carrot", value: "carrot", group: "Vegetable" },
  { label: "Leek", value: "leek", group: "Vegetable" },
]

export const App = () => {
  const filters = useFilter({ sensitivity: "base" })
  const { collection, filter } = useListCollection({
    initialItems: fruits,
    filter: filters().contains,
    groupBy: (item) => item.group,
  })

  return (
    <Combobox.Root collection={collection()} onInputValueChange={(event) => filter(event.inputValue)}>
      <Combobox.Label>Produce</Combobox.Label>
      <Combobox.Control>
        <Combobox.Input placeholder="Type to search" />
        <Combobox.IndicatorGroup>
          <Combobox.Trigger />
        </Combobox.IndicatorGroup>
      </Combobox.Control>
      <Portal>
        <Combobox.Positioner>
          <Combobox.Content>
            <Combobox.Empty>No items found</Combobox.Empty>
            <For each={collection().group()}>
              {([group, items]) => (
                <Combobox.ItemGroup>
                  <Combobox.ItemGroupLabel>{group}</Combobox.ItemGroupLabel>
                  <For each={items}>
                    {(item) => (
                      <Combobox.Item item={item}>
                        {item.label}
                        <Combobox.ItemIndicator />
                      </Combobox.Item>
                    )}
                  </For>
                </Combobox.ItemGroup>
              )}
            </For>
          </Combobox.Content>
        </Combobox.Positioner>
      </Portal>
    </Combobox.Root>
  )
}
