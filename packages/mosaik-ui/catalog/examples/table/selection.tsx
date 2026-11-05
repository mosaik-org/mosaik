import { Checkbox, Table } from "@mosaik/mosaik-ui"
import { createSignal, For } from "solid-js"

const items = [
  { id: 1, name: "Laptop", category: "Electronics" },
  { id: 2, name: "Coffee Maker", category: "Home Appliances" },
  { id: 3, name: "Desk Chair", category: "Furniture" },
  { id: 4, name: "Headphones", category: "Accessories" },
]

export const App = () => {
  const [selected, setSelected] = createSignal<ReadonlyArray<number>>([2])

  const all = () => selected().length === items.length
  const some = () => selected().length > 0 && !all()
  const toggle = (id: number, checked: boolean) =>
    setSelected((current) => (checked ? [...current, id] : current.filter((other) => other !== id)))

  return (
    <Table.Root>
      <Table.Head>
        <Table.Row>
          <Table.Header w="10">
            <Checkbox.Root
              size="sm"
              checked={some() ? "indeterminate" : all()}
              onCheckedChange={(event) => setSelected(event.checked === true ? items.map((item) => item.id) : [])}
            >
              <Checkbox.HiddenInput aria-label="Select all" />
              <Checkbox.Control>
                <Checkbox.Indicator />
              </Checkbox.Control>
            </Checkbox.Root>
          </Table.Header>
          <Table.Header>Product</Table.Header>
          <Table.Header>Category</Table.Header>
        </Table.Row>
      </Table.Head>
      <Table.Body>
        <For each={items}>
          {(item) => (
            // `data-selected`, as `aria-selected` is for grids, not for a table's rows.
            <Table.Row data-selected={selected().includes(item.id) ? "" : undefined}>
              <Table.Cell>
                <Checkbox.Root
                  size="sm"
                  checked={selected().includes(item.id)}
                  onCheckedChange={(event) => toggle(item.id, event.checked === true)}
                >
                  <Checkbox.HiddenInput aria-label={`Select ${item.name}`} />
                  <Checkbox.Control>
                    <Checkbox.Indicator />
                  </Checkbox.Control>
                </Checkbox.Root>
              </Table.Cell>
              <Table.Cell>{item.name}</Table.Cell>
              <Table.Cell>{item.category}</Table.Cell>
            </Table.Row>
          )}
        </For>
      </Table.Body>
    </Table.Root>
  )
}
