import { Combobox, useFilter, useListCollection } from "@mosaik/mosaik-ui"
import { For } from "solid-js"
import { Portal } from "solid-js/web"

const countries = [
  { code: "PL", name: "Poland" },
  { code: "DE", name: "Germany" },
  { code: "JP", name: "Japan" },
  { code: "BR", name: "Brazil" },
]

export const App = () => {
  const filters = useFilter({ sensitivity: "base" })
  const { collection, filter } = useListCollection({
    initialItems: countries,
    filter: filters().contains,
    // What it searches and shows, and what a form submits: "Poland" and "PL".
    itemToString: (item) => item.name,
    itemToValue: (item) => item.code,
  })

  return (
    <Combobox.Root collection={collection()} name="country" onInputValueChange={(event) => filter(event.inputValue)}>
      <Combobox.Label>Country</Combobox.Label>
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
            <Combobox.Empty>No country found</Combobox.Empty>
            <For each={collection().items}>
              {(item) => (
                <Combobox.Item item={item}>
                  {item.name}
                  <Combobox.ItemIndicator />
                </Combobox.Item>
              )}
            </For>
          </Combobox.Content>
        </Combobox.Positioner>
      </Portal>
    </Combobox.Root>
  )
}
