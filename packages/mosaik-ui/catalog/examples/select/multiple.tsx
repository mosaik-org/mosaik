import { createListCollection, Select } from "@mosaik/mosaik-ui"
import { For } from "solid-js"

const collection = createListCollection({ items: ["Paid", "Shipped", "Refunded", "Cancelled"] })

export const App = () => (
  <Select.Root collection={collection} multiple defaultValue={["Paid", "Shipped"]} maxW="xs">
    <Select.Label>Statuses</Select.Label>
    <Select.Control>
      <Select.Trigger>
        <Select.ValueText placeholder="Choose" />
        <Select.IndicatorGroup>
          <Select.Indicator />
        </Select.IndicatorGroup>
      </Select.Trigger>
    </Select.Control>
    <Select.Positioner>
      <Select.Content>
        <For each={collection.items}>
          {(item) => (
            <Select.Item item={item}>
              <Select.ItemText>{item}</Select.ItemText>
              <Select.ItemIndicator />
            </Select.Item>
          )}
        </For>
      </Select.Content>
    </Select.Positioner>
  </Select.Root>
)
