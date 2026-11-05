import { createListCollection, Select } from "@mosaik/mosaik-ui"
import { For } from "solid-js"
import { select } from "styled-system/recipes"
import { Showcase } from "../../showcase"

const collection = createListCollection({ items: ["Paid", "Shipped", "Refunded"] })

export const App = () => (
  <Showcase values={select.variantMap.variant}>
    {(variant) => (
      <Select.Root collection={collection} variant={variant}>
        <Select.Label>{variant}</Select.Label>
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
    )}
  </Showcase>
)
