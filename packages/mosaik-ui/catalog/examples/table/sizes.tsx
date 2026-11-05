import { Table } from "@mosaik/mosaik-ui"
import { For } from "solid-js"
import { Stack } from "styled-system/jsx"
import { table } from "styled-system/recipes"
import { bySize } from "../../showcase"

const items = [
  { name: "Laptop", category: "Electronics", price: 999.99 },
  { name: "Coffee Maker", category: "Home Appliances", price: 49.99 },
  { name: "Desk Chair", category: "Furniture", price: 150.0 },
]

export const App = () => (
  <Stack gap="8">
    <For each={bySize(table.variantMap.size)}>
      {(size) => (
        <Table.Root size={size}>
          <Table.Head>
            <Table.Row>
              <Table.Header>Product</Table.Header>
              <Table.Header>Category</Table.Header>
              <Table.Header textAlign="end">Price</Table.Header>
            </Table.Row>
          </Table.Head>
          <Table.Body>
            <For each={items}>
              {(item) => (
                <Table.Row>
                  <Table.Cell>{item.name}</Table.Cell>
                  <Table.Cell>{item.category}</Table.Cell>
                  <Table.Cell textAlign="end">{item.price}</Table.Cell>
                </Table.Row>
              )}
            </For>
          </Table.Body>
        </Table.Root>
      )}
    </For>
  </Stack>
)
