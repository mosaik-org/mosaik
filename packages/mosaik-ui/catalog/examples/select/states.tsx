import { createListCollection, Select } from "@mosaik/mosaik-ui"
import { For } from "solid-js"
import { select } from "styled-system/recipes"
import { Matrix } from "../../showcase"

const collection = createListCollection({ items: ["Paid", "Shipped", "Refunded"] })

const STATES = ["normal", "disabled", "read only", "invalid"] as const

/** Every variant in each state it can be in. */
export const App = () => (
  <Matrix rows={select.variantMap.variant} columns={STATES}>
    {(variant, state) => (
      <Select.Root
        collection={collection}
        variant={variant}
        defaultValue={["Paid"]}
        width="36"
        disabled={state === "disabled"}
        readOnly={state === "read only"}
        invalid={state === "invalid"}
      >
        <Select.Label srOnly>
          {variant}, {state}
        </Select.Label>
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
  </Matrix>
)
