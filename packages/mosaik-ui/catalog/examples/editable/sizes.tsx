import { Editable } from "@mosaik/mosaik-ui"
import { For } from "solid-js"
import { Stack } from "styled-system/jsx"
import { editable } from "styled-system/recipes"
import { bySize } from "../../showcase"

export const App = () => {
  const sizes = bySize(editable.variantMap.size)
  return (
    <Stack gap="4">
      <For each={sizes}>
        {(size) => (
          <Editable.Root defaultValue="Click to edit" size={size}>
            <Editable.Preview />
            <Editable.Input />
          </Editable.Root>
        )}
      </For>
    </Stack>
  )
}
