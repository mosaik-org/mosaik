import { createListCollection, Field, Select } from "@mosaik/mosaik-ui"
import { For } from "solid-js"

const collection = createListCollection({ items: ["Paid", "Shipped", "Refunded"] })

export const App = () => {
  return (
    <Field.Root invalid maxW="xs">
      <Select.Root collection={collection}>
        <Select.Label>Status</Select.Label>
        <Select.Control>
          <Select.Trigger>
            <Select.ValueText placeholder="Choose a status" />
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
      <Field.ErrorText>
        <Field.ErrorIcon />
        Choose a status first
      </Field.ErrorText>
    </Field.Root>
  )
}
