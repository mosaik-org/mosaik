import { Combobox, createListCollection, Spinner } from "@mosaik/mosaik-ui"
import { createMemo, createSignal, For, Show } from "solid-js"
import { Portal } from "solid-js/web"

interface Person {
  readonly label: string
  readonly value: string
}

const people: ReadonlyArray<Person> = [
  { label: "Ada Lovelace", value: "ada" },
  { label: "Alan Turing", value: "alan" },
  { label: "Grace Hopper", value: "grace" },
  { label: "Katherine Johnson", value: "katherine" },
]

/** Stands in for your API. */
const search = (query: string) =>
  new Promise<ReadonlyArray<Person>>((resolve) =>
    setTimeout(() => resolve(people.filter((person) => person.label.toLowerCase().includes(query.toLowerCase()))), 400),
  )

export const App = () => {
  const [items, setItems] = createSignal<ReadonlyArray<Person>>([])
  const [loading, setLoading] = createSignal(false)
  const [query, setQuery] = createSignal("")
  const collection = createMemo(() => createListCollection({ items: items() }))
  // The answer to the latest search only, as earlier ones can arrive after it.
  let latest = 0

  const onSearch = async (text: string) => {
    const mine = ++latest
    setQuery(text)
    if (text === "") {
      setLoading(false)
      setItems([])
      return
    }
    setLoading(true)
    const found = await search(text)
    if (mine !== latest) return
    setItems(found)
    setLoading(false)
  }

  return (
    <Combobox.Root collection={collection()} onInputValueChange={(event) => onSearch(event.inputValue)}>
      <Combobox.Label>Person</Combobox.Label>
      <Combobox.Control>
        <Combobox.Input placeholder="Type a name" />
        <Combobox.IndicatorGroup>
          <Show when={loading()}>
            <Spinner size="xs" />
          </Show>
        </Combobox.IndicatorGroup>
      </Combobox.Control>
      <Portal>
        <Combobox.Positioner>
          <Combobox.Content>
            <Show when={!loading() && query() !== ""}>
              <Combobox.Empty>No one found</Combobox.Empty>
            </Show>
            <For each={collection().items}>
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
  )
}
