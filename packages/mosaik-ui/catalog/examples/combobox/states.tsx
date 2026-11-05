import { Combobox, createListCollection } from "@mosaik/mosaik-ui"
import { For } from "solid-js"
import { Portal } from "solid-js/web"
import { Stack } from "styled-system/jsx"

const collection = createListCollection({
  items: [
    { label: "React", value: "react" },
    { label: "Solid", value: "solid" },
    { label: "Angular", value: "angular", disabled: true },
  ],
})

const states = [
  { label: "Disabled", props: { disabled: true } },
  { label: "Invalid", props: { invalid: true } },
  { label: "Read only", props: { readOnly: true, defaultInputValue: "Solid" } },
] as const

export const App = () => (
  <Stack gap="4">
    <For each={states}>
      {(state) => (
        <Combobox.Root collection={collection} {...state.props}>
          <Combobox.Label>{state.label}</Combobox.Label>
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
        </Combobox.Root>
      )}
    </For>
  </Stack>
)
