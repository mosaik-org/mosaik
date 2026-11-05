import { Command, createListCollection } from "@mosaik/mosaik-ui"
import { For } from "solid-js"
import { command } from "styled-system/recipes"
import { bySize, Showcase } from "../../showcase"

const collection = createListCollection({ items: ["New order", "Export orders", "Open settings"] })

export const App = () => (
  <Showcase values={bySize(command.variantMap.size)}>
    {(size) => (
      <Command.Root collection={collection} size={size} borderWidth="1px">
        <Command.Label>Commands, {size}</Command.Label>
        <Command.Control>
          <Command.Indicator />
          <Command.Input placeholder="Search" />
        </Command.Control>
        <Command.List>
          <For each={collection.items}>
            {(item) => (
              <Command.Item item={item}>
                <Command.ItemContent>
                  <Command.ItemText>{item}</Command.ItemText>
                </Command.ItemContent>
              </Command.Item>
            )}
          </For>
        </Command.List>
      </Command.Root>
    )}
  </Showcase>
)
