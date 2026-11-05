import { useListCollection } from "@ark-ui/solid/collection"
import { useFilter } from "@ark-ui/solid/locale"
import { Button, Command, Kbd } from "@mosaik/mosaik-ui"
import FileText from "lucide-solid/icons/file-text"
import Settings from "lucide-solid/icons/settings"
import { createSignal, For } from "solid-js"
import { Portal } from "solid-js/web"

export const App = () => {
  const [open, setOpen] = createSignal(false)
  const filters = useFilter({ sensitivity: "base" })
  const { collection, filter } = useListCollection({
    initialItems: commands,
    filter: filters().contains,
    groupBy: (item) => item.group,
  })

  return (
    <Command.Dialog open={open()} onOpenChange={(details) => setOpen(details.open)}>
      <Command.DialogTrigger asChild={(trigger) => <Button {...trigger()}>Open the palette</Button>} />
      <Portal>
        <Command.DialogBackdrop />
        <Command.DialogContent>
          <Command.Root
            collection={collection()}
            onInputValueChange={(details) => filter(details.inputValue)}
            // Running a command leaves the palette.
            onSelect={() => setOpen(false)}
          >
            <Command.Control>
              <Command.Indicator />
              <Command.Input placeholder="Search pages and actions" />
            </Command.Control>
            <Command.List>
              <Command.Empty>No results</Command.Empty>
              <For each={collection().group()}>
                {([group, items]) => (
                  <Command.ItemGroup>
                    <Command.ItemGroupLabel>{group}</Command.ItemGroupLabel>
                    <For each={items}>
                      {(item) => (
                        <Command.Item item={item}>
                          <Command.ItemIcon>
                            {item.group === "Pages" ? <FileText size={16} /> : <Settings size={16} />}
                          </Command.ItemIcon>
                          <Command.ItemContent>
                            <Command.ItemText>{item.label}</Command.ItemText>
                            <Command.ItemDescription>{item.description}</Command.ItemDescription>
                          </Command.ItemContent>
                        </Command.Item>
                      )}
                    </For>
                  </Command.ItemGroup>
                )}
              </For>
            </Command.List>
            <Command.Footer>
              <span>
                <Kbd>↑</Kbd> <Kbd>↓</Kbd> navigate
              </span>
              <span>
                <Kbd>↵</Kbd> open
              </span>
              <span>
                <Kbd>esc</Kbd> close
              </span>
            </Command.Footer>
          </Command.Root>
        </Command.DialogContent>
      </Portal>
    </Command.Dialog>
  )
}

const commands = [
  { label: "Orders", value: "orders", group: "Pages", description: "Everything customers ordered" },
  { label: "Customers", value: "customers", group: "Pages", description: "Who buys from you" },
  { label: "Export orders", value: "export", group: "Actions", description: "As a CSV file" },
  { label: "Change the theme", value: "theme", group: "Actions", description: "Light or dark" },
]
