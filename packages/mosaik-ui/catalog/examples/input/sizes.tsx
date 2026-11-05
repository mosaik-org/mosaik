import { Input } from "@mosaik/mosaik-ui"
import { For } from "solid-js"
import { Stack } from "styled-system/jsx"
import { input } from "styled-system/recipes"
import { bySize } from "../../showcase"

export const App = () => {
  const sizes = bySize(input.variantMap.size)
  return (
    <Stack gap="4">
      <For each={sizes}>{(size) => <Input placeholder={size} size={size} />}</For>
    </Stack>
  )
}
