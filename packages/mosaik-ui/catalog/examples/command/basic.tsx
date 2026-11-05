import { useListCollection } from "@ark-ui/solid/collection"
import { useFilter } from "@ark-ui/solid/locale"
import { Command, Kbd } from "@mosaik/mosaik-ui"
import { For } from "solid-js"

export const App = () => {
  const filters = useFilter({ sensitivity: "base" })
  const { collection, filter } = useListCollection({
    initialItems: commands,
    filter: filters().contains,
  })

  return (
    <Command.Root
      collection={collection()}
      onInputValueChange={(details) => filter(details.inputValue)}
      borderWidth="1px"
      maxW="md"
      maxH="72"
    >
      <Command.Label>Search commands</Command.Label>
      <Command.Control>
        <Command.Indicator />
        <Command.Input placeholder="Type a command" />
      </Command.Control>
      <Command.List>
        <Command.Empty>No results</Command.Empty>
        <For each={collection().items}>
          {(item) => (
            <Command.Item item={item}>
              <Command.ItemContent>
                <Command.ItemText>{item.label}</Command.ItemText>
              </Command.ItemContent>
              <Command.ItemCommand>
                <Kbd>{item.shortcut}</Kbd>
              </Command.ItemCommand>
            </Command.Item>
          )}
        </For>
      </Command.List>
    </Command.Root>
  )
}

const commands = [
  { label: "New order", value: "new-order", shortcut: "N" },
  { label: "Export orders", value: "export", shortcut: "E" },
  { label: "Find a customer", value: "find", shortcut: "F" },
  { label: "Open settings", value: "settings", shortcut: "S" },
]
